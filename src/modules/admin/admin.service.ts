import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';

type HeroSlide = {
  id: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  title: string;
  subtitle: string;
  buttonText: string;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promoCodes: PromoCodesService,
  ) {}

  async stats(role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Admin only', 403);
    }

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers,
      salonAdmins,
      newUsersThisMonth,
      newUsersLastMonth,
      salonStatusGroups,
      newSalonsThisMonth,
      totalBookings,
      bookingsThisMonth,
      bookingsLastMonth,
      bookingStatusGroups,
      activeSubscriptions,
      plans,
      planDistributionRaw,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'SALON_ADMIN' } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfThisMonth } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } } }),

      this.prisma.salon.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.salon.count({ where: { createdAt: { gte: startOfThisMonth } } }),

      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { createdAt: { gte: startOfThisMonth } } }),
      this.prisma.booking.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } } }),

      this.prisma.booking.groupBy({ by: ['status'], _count: { id: true } }),

      this.prisma.ownerSubscription.count({ where: { status: 'ACTIVE' } }),

      this.prisma.subscriptionPlan.findMany({ select: { id: true, name: true, priceCents: true } }),

      this.prisma.ownerSubscription.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
      }),
    ]);

    // Salon breakdown
    const salonByStatus = Object.fromEntries(
      salonStatusGroups.map((g) => [g.status, g._count.id]),
    );
    const totalSalons = Object.values(salonByStatus).reduce((a, b) => a + b, 0);

    // Active bookings
    const activeBookings = bookingStatusGroups
      .filter((g) => g.status === 'CONFIRMED')
      .reduce((sum, g) => sum + g._count.id, 0);

    // Plan distribution
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));
    const planDistribution = planDistributionRaw.map((row) => ({
      name: planMap[row.planId]?.name ?? 'Unknown',
      count: row._count.id,
      pct:
        activeSubscriptions > 0
          ? Math.round((row._count.id / activeSubscriptions) * 100)
          : 0,
    }));

    // Revenue this month / last month / all-time — from subscription starts in each period
    const [revenueThisMonth, revenueLastMonth, revenueTotalCents] = await Promise.all([
      this.revenueInRange(startOfThisMonth, now),
      this.revenueInRange(startOfLastMonth, startOfThisMonth),
      this.revenueAllTime(),
    ]);

    // Last 6 months series
    const monthSlots = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

    const [monthlyRevenue, monthlyBookings] = await Promise.all([
      Promise.all(
        monthSlots.map(async ({ year, month }) => {
          const start = new Date(year, month, 1);
          const end = new Date(year, month + 1, 1);
          const revenueCents = await this.revenueInRange(start, end);
          return { year, month: month + 1, revenueCents };
        }),
      ),
      Promise.all(
        monthSlots.map(async ({ year, month }) => {
          const start = new Date(year, month, 1);
          const end = new Date(year, month + 1, 1);
          const count = await this.prisma.booking.count({
            where: { createdAt: { gte: start, lt: end } },
          });
          return { year, month: month + 1, count };
        }),
      ),
    ]);

    return {
      overview: {
        totalSalons,
        publishedSalons: salonByStatus['PUBLISHED'] ?? 0,
        draftSalons: salonByStatus['DRAFT'] ?? 0,
        suspendedSalons: salonByStatus['SUSPENDED'] ?? 0,
        newSalonsThisMonth,
        totalUsers,
        salonAdmins,
        newUsersThisMonth,
        newUsersLastMonth,
        totalBookings,
        bookingsThisMonth,
        bookingsLastMonth,
        activeBookings,
        activeSubscriptions,
        revenueThisMonthCents: revenueThisMonth,
        revenueLastMonthCents: revenueLastMonth,
        revenueTotalCents,
      },
      bookingsByStatus: bookingStatusGroups.map((g) => ({
        status: g.status,
        count: g._count.id,
      })),
      planDistribution,
      monthlyRevenue,
      monthlyBookings,
    };
  }

  async listOwners() {
    const owners = await this.prisma.user.findMany({
      where: { role: 'SALON_ADMIN' },
      include: {
        ownedSalons: { select: { id: true, name: true, status: true } },
        ownerSubscriptions: {
          orderBy: { startsAt: 'desc' },
          take: 1,
          include: { plan: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return owners.map((u) => {
      const sub = u.ownerSubscriptions[0] ?? null;
      const status = u.accountStatus.toLowerCase() as 'active' | 'suspended' | 'pending';
      return {
        id: u.id,
        displayName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
        email: u.email,
        phone: u.phone ?? null,
        joinedAt: u.createdAt,
        status,
        salons: u.ownedSalons.map((s) => ({ id: s.id, name: s.name, status: s.status })),
        subscription: sub
          ? { planName: sub.plan.name, subStatus: sub.status, expiresAt: sub.expiresAt }
          : null,
      };
    });
  }

  // ── Website Settings ─────────────────────────────────────────────────────

  async getWebsiteSettings() {
    const rows = await this.prisma.websiteSetting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      heroSlides: Array.isArray(map.heroSlides) ? (map.heroSlides as HeroSlide[]) : [],
      footerText:
        typeof map.footerText === 'string'
          ? map.footerText
          : '© 2026 GlamBook. All rights reserved.',
      supportEmail:
        typeof map.supportEmail === 'string' ? map.supportEmail : 'support@glambook.com',
      metaTitle:
        typeof map.metaTitle === 'string' ? map.metaTitle : 'GlamBook - Luxury Salon Booking',
      metaDescription:
        typeof map.metaDescription === 'string'
          ? map.metaDescription
          : 'Book premium salon services instantly.',
    };
  }

  async saveHeroSlides(slides: HeroSlide[]) {
    await this.prisma.websiteSetting.upsert({
      where: { key: 'heroSlides' },
      update: { value: slides as unknown as Prisma.InputJsonValue },
      create: { key: 'heroSlides', value: slides as unknown as Prisma.InputJsonValue },
    });
    return { message: 'Hero slides saved' };
  }

  async saveFooter(data: { footerText: string; supportEmail: string }) {
    await Promise.all([
      this.prisma.websiteSetting.upsert({
        where: { key: 'footerText' },
        update: { value: data.footerText },
        create: { key: 'footerText', value: data.footerText },
      }),
      this.prisma.websiteSetting.upsert({
        where: { key: 'supportEmail' },
        update: { value: data.supportEmail },
        create: { key: 'supportEmail', value: data.supportEmail },
      }),
    ]);
    return { message: 'Footer settings saved' };
  }

  async saveSeo(data: { metaTitle: string; metaDescription: string }) {
    await Promise.all([
      this.prisma.websiteSetting.upsert({
        where: { key: 'metaTitle' },
        update: { value: data.metaTitle },
        create: { key: 'metaTitle', value: data.metaTitle },
      }),
      this.prisma.websiteSetting.upsert({
        where: { key: 'metaDescription' },
        update: { value: data.metaDescription },
        create: { key: 'metaDescription', value: data.metaDescription },
      }),
    ]);
    return { message: 'SEO settings saved' };
  }

  // ── Salon Moderation ─────────────────────────────────────────────────────

  async listSalons() {
    const salons = await this.prisma.salon.findMany({
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return salons.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      city: s.city,
      country: s.country,
      status: s.status,
      owner: {
        id: s.owner.id,
        displayName:
          [s.owner.firstName, s.owner.lastName].filter(Boolean).join(' ') || s.owner.email,
        email: s.owner.email,
      },
      bookingCount: s._count.bookings,
      createdAt: s.createdAt,
    }));
  }

  async publishSalon(id: string) {
    const salon = await this.prisma.salon.findUnique({ where: { id } });
    if (!salon) throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    await this.prisma.salon.update({ where: { id }, data: { status: 'PUBLISHED' } });
    return { message: 'Salon published' };
  }

  async suspendSalon(id: string) {
    const salon = await this.prisma.salon.findUnique({ where: { id } });
    if (!salon) throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    await this.prisma.salon.update({ where: { id }, data: { status: 'SUSPENDED' } });
    return { message: 'Salon suspended' };
  }

  async draftSalon(id: string) {
    const salon = await this.prisma.salon.findUnique({ where: { id } });
    if (!salon) throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    await this.prisma.salon.update({ where: { id }, data: { status: 'DRAFT' } });
    return { message: 'Salon moved to draft' };
  }

  async approveOwner(ownerId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!user || user.role !== 'SALON_ADMIN') {
      throw new DomainException('NOT_FOUND', 'Salon owner not found', 404);
    }
    await this.prisma.user.update({
      where: { id: ownerId },
      data: { accountStatus: 'ACTIVE' },
    });
    return { message: 'Owner approved' };
  }

  async suspendOwner(ownerId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!user || user.role !== 'SALON_ADMIN') {
      throw new DomainException('NOT_FOUND', 'Salon owner not found', 404);
    }
    await this.prisma.user.update({
      where: { id: ownerId },
      data: { accountStatus: 'SUSPENDED' },
    });
    return { message: 'Owner suspended' };
  }

  async activateOwner(ownerId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!user || user.role !== 'SALON_ADMIN') {
      throw new DomainException('NOT_FOUND', 'Salon owner not found', 404);
    }
    await this.prisma.user.update({
      where: { id: ownerId },
      data: { accountStatus: 'ACTIVE' },
    });
    return { message: 'Owner activated' };
  }

  // ── SMS Campaign ─────────────────────────────────────────────────────────

  async getCampaignCustomers(segment: string) {
    const now = new Date();
    const where: Prisma.BookingWhereInput = { guestPhone: { not: null } };

    if (segment === 'last3months') {
      const d = new Date(now); d.setMonth(d.getMonth() - 3);
      where.startAt = { gte: d };
    } else if (segment === 'last6months') {
      const d = new Date(now); d.setMonth(d.getMonth() - 6);
      where.startAt = { gte: d };
    } else if (segment === 'last12months') {
      const d = new Date(now); d.setMonth(d.getMonth() - 12);
      where.startAt = { gte: d };
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      select: { guestName: true, guestPhone: true, guestEmail: true },
    });

    const customerMap = new Map<string, { name: string; phone: string; email: string | null; bookingCount: number }>();
    for (const b of bookings) {
      if (!b.guestPhone) continue;
      const existing = customerMap.get(b.guestPhone);
      if (existing) {
        existing.bookingCount++;
      } else {
        customerMap.set(b.guestPhone, {
          name: b.guestName ?? 'Unknown',
          phone: b.guestPhone,
          email: b.guestEmail ?? null,
          bookingCount: 1,
        });
      }
    }

    let customers = Array.from(customerMap.values());
    if (segment === 'regular') {
      customers = customers.filter((c) => c.bookingCount >= 2);
    }

    return { customers, count: customers.length };
  }

  async getCampaignServices() {
    const services = await this.prisma.service.findMany({
      where: { active: true },
      include: { salon: { select: { name: true } } },
      orderBy: [{ salon: { name: 'asc' } }, { name: 'asc' }],
    });

    return services.map((s) => ({
      id: s.id,
      name: s.name,
      salonName: s.salon.name,
      priceCents: s.priceCents,
      durationMin: s.durationMin,
    }));
  }

  async sendSmsCampaign(body: {
    campaignName: string;
    segment: string;
    discountPct: number;
    discountScope: string;
    serviceIds: string[];
    validFrom: string;
    validTo: string;
    customLink: string;
    message: string;
    scheduledAt?: string;
    recipientCount: number;
  }) {
    console.log('[SMS Campaign]', JSON.stringify(body, null, 2));
    return { message: 'Campaign scheduled successfully', recipientCount: body.recipientCount };
  }

  // ── SMS Campaign Price & Requests ─────────────────────────────────────────

  async getSmsCampaignPrice(): Promise<{ priceCents: number }> {
    const row = await this.prisma.websiteSetting.findUnique({ where: { key: 'smsCampaignPriceCents' } });
    const priceCents = row ? Number(row.value) : 0;
    return { priceCents };
  }

  async setSmsCampaignPrice(priceCents: number): Promise<{ priceCents: number }> {
    await this.prisma.websiteSetting.upsert({
      where: { key: 'smsCampaignPriceCents' },
      update: { value: priceCents },
      create: { key: 'smsCampaignPriceCents', value: priceCents },
    });
    return { priceCents };
  }

  async listCampaignRequests() {
    const requests = await this.prisma.smsCampaignRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        salon: { select: { id: true, name: true, slug: true } },
        promoCode: { select: { code: true, usageCount: true, active: true } },
      },
    });

    return requests.map((r) => ({
      id: r.id,
      campaignName: r.campaignName,
      segment: r.segment,
      discountPct: r.discountPct,
      discountScope: r.discountScope,
      serviceIds: r.serviceIds,
      validFrom: r.validFrom,
      validTo: r.validTo,
      message: r.message,
      recipientCount: r.recipientCount,
      receiptUrl: r.receiptUrl,
      priceCents: r.priceCents,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
      owner: {
        id: r.owner.id,
        displayName: [r.owner.firstName, r.owner.lastName].filter(Boolean).join(' ') || r.owner.email,
        email: r.owner.email,
      },
      salon: { id: r.salon.id, name: r.salon.name, slug: r.salon.slug },
      promoCode: r.promoCode,
    }));
  }

  async approveCampaignRequest(id: string) {
    const req = await this.prisma.smsCampaignRequest.findUnique({ where: { id } });
    if (!req) throw new DomainException('NOT_FOUND', 'Campaign request not found', 404);
    if (req.status !== 'PENDING') {
      throw new DomainException('INVALID_STATE', 'Only pending requests can be approved', 400);
    }

    const promo = await this.promoCodes.create({
      salonId: req.salonId,
      campaignName: req.campaignName,
      recipientCount: req.recipientCount,
      discountPct: req.discountPct,
      discountScope: req.discountScope,
      serviceIds: (req.serviceIds as string[]) ?? [],
      validFrom: req.validFrom?.toISOString(),
      validTo: req.validTo?.toISOString(),
    });

    await this.prisma.smsCampaignRequest.update({
      where: { id },
      data: { status: 'APPROVED', promoCodeId: promo.id },
    });

    const salon = await this.prisma.salon.findUnique({ where: { id: req.salonId } });
    return { message: 'Campaign approved', promoCode: promo.code, salonSlug: salon?.slug ?? '' };
  }

  async rejectCampaignRequest(id: string, note: string) {
    const req = await this.prisma.smsCampaignRequest.findUnique({ where: { id } });
    if (!req) throw new DomainException('NOT_FOUND', 'Campaign request not found', 404);
    if (req.status !== 'PENDING') {
      throw new DomainException('INVALID_STATE', 'Only pending requests can be rejected', 400);
    }

    await this.prisma.smsCampaignRequest.update({
      where: { id },
      data: { status: 'REJECTED', adminNote: note || null },
    });

    return { message: 'Campaign rejected' };
  }

  private async revenueInRange(from: Date, to: Date): Promise<number> {
    const subs = await this.prisma.ownerSubscription.findMany({
      where: { startsAt: { gte: from, lt: to } },
      include: { plan: { select: { priceCents: true } } },
    });
    return subs.reduce((sum, s) => sum + s.plan.priceCents, 0);
  }

  async listPromoCodes() {
    const codes = await this.prisma.promoCode.findMany({
      include: { salon: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return codes.map((c) => ({
      id: c.id,
      code: c.code,
      salonName: c.salon.name,
      campaignName: c.campaignName ?? null,
      discountPct: c.discountPct,
      discountScope: c.discountScope,
      usageCount: c.usageCount,
      usageLimit: c.usageLimit ?? null,
      validFrom: c.validFrom ?? null,
      validTo: c.validTo ?? null,
      active: c.active,
      createdAt: c.createdAt,
    }));
  }

  private async revenueAllTime(): Promise<number> {
    const subs = await this.prisma.ownerSubscription.findMany({
      include: { plan: { select: { priceCents: true } } },
    });
    return subs.reduce((sum, s) => sum + s.plan.priceCents, 0);
  }
}
