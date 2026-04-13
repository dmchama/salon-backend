import { Injectable } from '@nestjs/common';
import { OwnerSubscriptionStatus, Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateOwnerSubscriptionDto } from './dto/create-owner-subscription.dto';

@Injectable()
export class OwnerSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: CreateOwnerSubscriptionDto, ownerId: string, role: Role) {
    if (role !== Role.OWNER) {
      throw new DomainException('FORBIDDEN', 'Owner only', 403);
    }
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: dto.planId, active: true },
    });
    if (!plan) {
      throw new DomainException('NOT_FOUND', 'Plan not found', 404);
    }
    const startsAt = new Date();
    const expiresAt = new Date(startsAt);
    expiresAt.setMonth(expiresAt.getMonth() + plan.intervalMonths);

    return this.prisma.ownerSubscription.create({
      data: {
        ownerId,
        planId: plan.id,
        startsAt,
        expiresAt,
        status: OwnerSubscriptionStatus.ACTIVE,
      },
      include: { plan: true },
    });
  }

  listMine(ownerId: string, role: Role) {
    if (role !== Role.OWNER) {
      throw new DomainException('FORBIDDEN', 'Owner only', 403);
    }
    return this.prisma.ownerSubscription.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
  }
}
