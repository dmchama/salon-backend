import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
      .filter((g) => g.status === 'PENDING' || g.status === 'CONFIRMED')
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

    // Revenue this month / last month — from subscription starts in each period
    const revenueThisMonth = await this.revenueInRange(startOfThisMonth, now);
    const revenueLastMonth = await this.revenueInRange(
      startOfLastMonth,
      startOfThisMonth,
    );

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

  private async revenueInRange(from: Date, to: Date): Promise<number> {
    const subs = await this.prisma.ownerSubscription.findMany({
      where: { startsAt: { gte: from, lt: to } },
      include: { plan: { select: { priceCents: true } } },
    });
    return subs.reduce((sum, s) => sum + s.plan.priceCents, 0);
  }
}
