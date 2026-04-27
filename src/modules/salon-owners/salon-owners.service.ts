import { Injectable } from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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

    return { salons, subscription, insights };
  }

  private async buildInsights(
    salonIds: string[],
    salons: { _count: { bookings: number; services: number } }[],
  ) {
    const empty = {
      totals: {
        bookings: 0,
        pendingBookings: 0,
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
        where: { salonId: { in: salonIds }, status: BookingStatus.PENDING },
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
      if (row.status === BookingStatus.PENDING) totals.pendingBookings = n;
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
