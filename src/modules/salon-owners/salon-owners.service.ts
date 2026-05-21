import { Injectable } from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { SmslenzService } from '../notifications/providers/smslenz.service';

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function formatUtcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class SalonOwnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promoCodes: PromoCodesService,
    private readonly sms: SmslenzService,
  ) {}

  async dashboard(ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Owner only', 403);
    }
    const salonsRaw = await this.prisma.salon.findMany({
      where: { ownerId },
      include: {
        _count: {
          select: {
            bookings: true,
            services: true,
          },
        },
      },
    });

    const salonIds = salonsRaw.map((s) => s.id);
    let activeServicesBySalonId: Record<string, number> = {};
    if (salonIds.length > 0) {
      const activeGrouped = await this.prisma.service.groupBy({
        by: ['salonId'],
        where: { salonId: { in: salonIds }, active: true },
        _count: { _all: true },
      });
      activeServicesBySalonId = Object.fromEntries(
        activeGrouped.map((g) => [g.salonId, g._count._all]),
      );
    }

    const salons = salonsRaw.map((s) => ({
      ...s,
      _count: {
        bookings: s._count.bookings,
        services: activeServicesBySalonId[s.id] ?? 0,
      },
    }));

    const subscription = await this.prisma.ownerSubscription.findFirst({
      where: { ownerId, status: 'ACTIVE' },
      orderBy: { expiresAt: 'desc' },
      include: { plan: true },
    });

    const insights = await this.buildInsights(salonIds, salons);

    const planLimits = subscription?.plan.limits as {
      maxSalons?: number;
      monthlyBookingLimit?: number;
      maxGalleryImagesPerSalon?: number;
      analyticsLevel?: string;
    } | null ?? null;

    return {
      salons,
      subscription,
      insights,
      planLimits: {
        maxSalons: planLimits?.maxSalons ?? 1,
        monthlyBookingLimit: planLimits?.monthlyBookingLimit ?? 200,
        maxGalleryImagesPerSalon: planLimits?.maxGalleryImagesPerSalon ?? 10,
        analyticsLevel: planLimits?.analyticsLevel ?? 'basic',
      },
    };
  }

  // ── SMS Campaign (scoped to owner's salon) ──────────────────────────────

  async getOwnerCampaignCustomers(ownerId: string, salonId: string, segment: string) {
    const salon = await this.prisma.salon.findFirst({ where: { id: salonId, ownerId } });
    if (!salon) throw new DomainException('NOT_FOUND', 'Salon not found', 404);

    const now = new Date();
    const where: any = { salonId, guestPhone: { not: null } };

    if (segment === 'last3months') {
      const d = new Date(now); d.setMonth(d.getMonth() - 3); where.startAt = { gte: d };
    } else if (segment === 'last6months') {
      const d = new Date(now); d.setMonth(d.getMonth() - 6); where.startAt = { gte: d };
    } else if (segment === 'last12months') {
      const d = new Date(now); d.setMonth(d.getMonth() - 12); where.startAt = { gte: d };
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      select: { guestName: true, guestPhone: true, guestEmail: true },
    });

    const customerMap = new Map<string, { name: string; phone: string; email: string | null; bookingCount: number }>();
    for (const b of bookings) {
      if (!b.guestPhone) continue;
      const existing = customerMap.get(b.guestPhone);
      if (existing) { existing.bookingCount++; }
      else { customerMap.set(b.guestPhone, { name: b.guestName ?? 'Unknown', phone: b.guestPhone, email: b.guestEmail ?? null, bookingCount: 1 }); }
    }

    let customers = Array.from(customerMap.values());
    if (segment === 'regular') customers = customers.filter((c) => c.bookingCount >= 2);

    return { customers, count: customers.length };
  }

  async getOwnerCampaignServices(ownerId: string, salonId: string) {
    const salon = await this.prisma.salon.findFirst({ where: { id: salonId, ownerId } });
    if (!salon) throw new DomainException('NOT_FOUND', 'Salon not found', 404);

    const services = await this.prisma.service.findMany({
      where: { salonId, active: true },
      orderBy: { name: 'asc' },
    });

    return services.map((s) => ({
      id: s.id,
      name: s.name,
      priceCents: s.priceCents,
      durationMin: s.durationMin,
      salonName: salon.name,
    }));
  }

  async getSmsCampaignPrice(): Promise<{ priceCents: number }> {
    const row = await this.prisma.websiteSetting.findUnique({ where: { key: 'smsCampaignPriceCents' } });
    return { priceCents: row ? Number(row.value) : 0 };
  }

  async submitCampaignRequest(ownerId: string, body: {
    salonId: string; campaignName: string; segment: string;
    discountPct: number; discountScope: string; serviceIds: string[];
    validFrom?: string; validTo?: string;
    message: string; scheduledAt?: string; recipientCount: number;
  }, receiptUrl?: string) {
    const salon = await this.prisma.salon.findFirst({ where: { id: body.salonId, ownerId } });
    if (!salon) throw new DomainException('NOT_FOUND', 'Salon not found', 404);

    const priceRow = await this.prisma.websiteSetting.findUnique({ where: { key: 'smsCampaignPriceCents' } });
    const perSmsPriceCents = priceRow ? Number(priceRow.value) : 0;
    const totalPriceCents = perSmsPriceCents * (body.recipientCount || 0);

    const request = await this.prisma.smsCampaignRequest.create({
      data: {
        ownerId,
        salonId: body.salonId,
        campaignName: body.campaignName,
        segment: body.segment,
        discountPct: body.discountPct,
        discountScope: body.discountScope,
        serviceIds: body.serviceIds?.length ? body.serviceIds : undefined,
        validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
        validTo: body.validTo ? new Date(body.validTo) : undefined,
        message: body.message,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        recipientCount: body.recipientCount,
        receiptUrl: receiptUrl ?? null,
        priceCents: totalPriceCents,
      },
    });

    return { message: 'Campaign request submitted', requestId: request.id };
  }

  async sendOwnerSmsCampaign(ownerId: string, body: {
    salonId: string; campaignName: string; segment: string;
    discountPct: number; discountScope: string; serviceIds: string[];
    validFrom: string; validTo: string;
    message: string; scheduledAt?: string; recipientCount: number;
  }) {
    const salon = await this.prisma.salon.findFirst({ where: { id: body.salonId, ownerId } });
    if (!salon) throw new DomainException('NOT_FOUND', 'Salon not found', 404);

    const promo = await this.promoCodes.create({
      salonId: body.salonId,
      campaignName: body.campaignName,
      recipientCount: body.recipientCount,
      discountPct: body.discountPct,
      discountScope: body.discountScope,
      serviceIds: body.serviceIds ?? [],
      validFrom: body.validFrom || undefined,
      validTo: body.validTo || undefined,
    });

    const { customers } = await this.getOwnerCampaignCustomers(ownerId, body.salonId, body.segment);
    const phones = customers.map((c) => c.phone).filter(Boolean);
    if (phones.length > 0) {
      const frontendUrl = process.env.FRONTEND_URL ?? '';
      const bookingLink = `${frontendUrl}/book/${salon.slug}?promo=${promo.code}`;
      const fullMessage = [
        body.message,
        `\n${salon.name}`,
        `Book now: ${bookingLink}`,
      ].join('\n');
      await this.sms.sendBulkSms(phones, fullMessage);
    }

    return {
      message: 'Campaign sent successfully',
      recipientCount: phones.length,
      promoCode: promo.code,
      salonSlug: salon.slug,
    };
  }

  async getOwnerCampaignHistory(ownerId: string, salonId: string) {
    const salon = await this.prisma.salon.findFirst({ where: { id: salonId, ownerId } });
    if (!salon) throw new DomainException('NOT_FOUND', 'Salon not found', 404);

    const requests = await this.prisma.smsCampaignRequest.findMany({
      where: { salonId, ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        promoCode: { select: { code: true, usageCount: true, active: true } },
      },
    });

    return requests.map((r) => ({
      id: r.id,
      campaignName: r.campaignName,
      discountPct: r.discountPct,
      discountScope: r.discountScope,
      recipientCount: r.recipientCount,
      priceCents: r.priceCents,
      status: r.status,
      adminNote: r.adminNote,
      validFrom: r.validFrom,
      validTo: r.validTo,
      receiptUrl: r.receiptUrl,
      createdAt: r.createdAt,
      promoCode: r.promoCode,
    }));
  }

  async getInsights(ownerId: string, salonId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Owner only', 403);
    }
    const salon = await this.prisma.salon.findFirst({
      where: { id: salonId, ownerId },
      include: { _count: { select: { bookings: true, services: true } } },
    });
    if (!salon) throw new DomainException('NOT_FOUND', 'Salon not found', 404);

    const activeServices = await this.prisma.service.count({
      where: { salonId, active: true },
    });

    return this.buildInsights(
      [salonId],
      [{ _count: { bookings: salon._count.bookings, services: activeServices } }],
    );
  }

  private async buildInsights(
    salonIds: string[],
    salons: { _count: { bookings: number; services: number } }[],
  ) {
    const empty = {
      totals: {
        bookings: 0,
        confirmedBookings: 0,
        activeServices: salons.reduce((acc, s) => acc + s._count.services, 0),
        completedRevenueCents: 0,
        uniqueGuestContacts: 0,
      },
      pendingBySalonId: {} as Record<string, number>,
      revenueByService: [] as { serviceId: string; name: string; totalCents: number }[],
      bookingsLast7Days: [] as { date: string; count: number }[],
      bookingsByWeek: [] as { weekLabel: string; count: number }[],
    };

    if (salonIds.length === 0) {
      return empty;
    }

    const now = new Date();
    const day0 = startOfUtcDay(now);
    const since7 = addUtcDays(day0, -6);
    const since28 = addUtcDays(day0, -27);

    const [statusAgg, pendingBySalon, completedWithService, contacts, trendRows] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { salonId: { in: salonIds } },
        _count: { _all: true },
      }),
      this.prisma.booking.groupBy({
        by: ['salonId'],
        where: { salonId: { in: salonIds }, status: BookingStatus.CONFIRMED },
        _count: { _all: true },
      }),
      this.prisma.booking.findMany({
        where: { salonId: { in: salonIds }, status: BookingStatus.COMPLETED },
        include: { service: true },
      }),
      this.prisma.booking.findMany({
        where: { salonId: { in: salonIds } },
        select: { guestEmail: true, customerId: true },
      }),
      this.prisma.booking.findMany({
        where: { salonId: { in: salonIds }, startAt: { gte: since28 } },
        select: { startAt: true },
      }),
    ]);

    const pendingBySalonId = Object.fromEntries(
      pendingBySalon.map((p) => [p.salonId, p._count._all]),
    );

    const totals = { ...empty.totals };
    for (const row of statusAgg) {
      const n = row._count._all;
      totals.bookings += n;
      if (row.status === BookingStatus.CONFIRMED) totals.confirmedBookings = n;
    }

    const revMap = new Map<string, { name: string; totalCents: number }>();
    for (const b of completedWithService) {
      const cur = revMap.get(b.serviceId) ?? { name: b.service.name, totalCents: 0 };
      cur.totalCents += b.service.priceCents;
      revMap.set(b.serviceId, cur);
    }
    totals.completedRevenueCents = [...revMap.values()].reduce((a, v) => a + v.totalCents, 0);

    const contactKeys = new Set<string>();
    for (const c of contacts) {
      const key = c.guestEmail?.trim().toLowerCase() || c.customerId || '';
      if (key) contactKeys.add(key);
    }
    totals.uniqueGuestContacts = contactKeys.size;

    const revenueByService = [...revMap.entries()].map(([serviceId, v]) => ({
      serviceId,
      name: v.name,
      totalCents: v.totalCents,
    }));

    const dayCounts = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      dayCounts.set(formatUtcDay(addUtcDays(since7, i)), 0);
    }
    for (const row of trendRows) {
      const key = formatUtcDay(startOfUtcDay(row.startAt));
      if (dayCounts.has(key)) {
        dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
      }
    }
    const bookingsLast7Days = [...dayCounts.entries()].map(([date, count]) => ({ date, count }));

    const weekCounts = [0, 0, 0, 0];
    for (const row of trendRows) {
      const sd = startOfUtcDay(row.startAt);
      const diffDays = Math.floor((day0.getTime() - sd.getTime()) / 86400000);
      if (diffDays < 0 || diffDays > 27) continue;
      const idx = Math.min(3, Math.floor(diffDays / 7));
      const bucket = 3 - idx;
      weekCounts[bucket] += 1;
    }
    const bookingsByWeek = weekCounts.map((count, i) => ({
      weekLabel: `Week ${i + 1}`,
      count,
    }));

    return {
      totals,
      pendingBySalonId,
      revenueByService,
      bookingsLast7Days,
      bookingsByWeek,
    };
  }
}
