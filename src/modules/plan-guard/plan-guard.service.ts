import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type PlanLimits = {
  maxSalons: number;                  // -1 = unlimited
  monthlyBookingLimit: number;
  maxGalleryImagesPerSalon: number;   // -1 = unlimited
  analyticsLevel: 'basic' | 'full' | 'full_export';
};

const DEFAULT_LIMITS: PlanLimits = {
  maxSalons: 1,
  monthlyBookingLimit: 200,
  maxGalleryImagesPerSalon: 10,
  analyticsLevel: 'basic',
};

@Injectable()
export class PlanGuardService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveLimits(ownerId: string): Promise<PlanLimits> {
    const sub = await this.prisma.ownerSubscription.findFirst({
      where: { ownerId, status: 'ACTIVE' },
      orderBy: { expiresAt: 'desc' },
      include: { plan: true },
    });
    if (!sub) return DEFAULT_LIMITS;
    const raw = sub.plan.limits as Partial<PlanLimits> | null;
    return { ...DEFAULT_LIMITS, ...(raw ?? {}) };
  }

  async requireActiveSubscription(ownerId: string): Promise<void> {
    const sub = await this.prisma.ownerSubscription.findFirst({
      where: { ownerId, status: 'ACTIVE' },
    });
    if (!sub) {
      throw new DomainException(
        'NO_SUBSCRIPTION',
        'An active subscription is required to accept bookings',
        403,
      );
    }
  }

  /** Owner must be approved (ACTIVE) to publish salons or take bookings (spec 002). */
  async requireApprovedAccount(ownerId: string): Promise<void> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { accountStatus: true },
    });
    if (owner?.accountStatus !== 'ACTIVE') {
      throw new DomainException(
        'ACCOUNT_NOT_APPROVED',
        'This account is waiting for payment verification by the platform admin',
        403,
      );
    }
  }

  async checkSalonLimit(ownerId: string): Promise<void> {
    const limits = await this.getActiveLimits(ownerId);
    if (limits.maxSalons === -1) return;
    const count = await this.prisma.salon.count({ where: { ownerId } });
    if (count >= limits.maxSalons) {
      throw new DomainException(
        'PLAN_LIMIT_EXCEEDED',
        `Your plan allows up to ${limits.maxSalons} salon(s). Upgrade to add more branches.`,
        403,
      );
    }
  }

  async checkGalleryLimit(ownerId: string, salonId: string): Promise<void> {
    const limits = await this.getActiveLimits(ownerId);
    if (limits.maxGalleryImagesPerSalon === -1) return;
    const count = await this.prisma.galleryItem.count({ where: { salonId } });
    if (count >= limits.maxGalleryImagesPerSalon) {
      throw new DomainException(
        'PLAN_LIMIT_EXCEEDED',
        `Your plan allows up to ${limits.maxGalleryImagesPerSalon} gallery images per salon. Upgrade to upload more.`,
        403,
      );
    }
  }

  /** Returns true if this booking exceeds the monthly quota (overage). Does NOT block it. */
  async isBookingOverage(ownerId: string): Promise<boolean> {
    const limits = await this.getActiveLimits(ownerId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const salonIds = await this.prisma.salon
      .findMany({ where: { ownerId }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    if (salonIds.length === 0) return false;

    const count = await this.prisma.booking.count({
      where: {
        salonId: { in: salonIds },
        createdAt: { gte: monthStart, lt: monthEnd },
      },
    });

    return count >= limits.monthlyBookingLimit;
  }
}
