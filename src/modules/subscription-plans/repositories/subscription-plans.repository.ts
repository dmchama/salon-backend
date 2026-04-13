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

  create(data: Prisma.SubscriptionPlanCreateInput): Promise<SubscriptionPlan> {
    return this.prisma.subscriptionPlan.create({ data });
  }
}
