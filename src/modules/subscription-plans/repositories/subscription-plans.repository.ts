import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class SubscriptionPlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(): Promise<SubscriptionPlan[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { priceCents: 'asc' },
    });
  }

  findAll(): Promise<SubscriptionPlan[]> {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { priceCents: 'asc' },
    });
  }

  findById(id: string): Promise<SubscriptionPlan | null> {
    return this.prisma.subscriptionPlan.findUnique({ where: { id } });
  }

  create(data: Prisma.SubscriptionPlanCreateInput): Promise<SubscriptionPlan> {
    return this.prisma.subscriptionPlan.create({ data });
  }

  update(id: string, data: Prisma.SubscriptionPlanUpdateInput): Promise<SubscriptionPlan> {
    return this.prisma.subscriptionPlan.update({ where: { id }, data });
  }

  delete(id: string): Promise<SubscriptionPlan> {
    return this.prisma.subscriptionPlan.delete({ where: { id } });
  }

  /** Count active subscriptions per plan */
  activeSubscriberCounts() {
    return this.prisma.ownerSubscription.groupBy({
      by: ['planId'],
      where: { status: 'ACTIVE' },
      _count: { id: true },
    });
  }
}
