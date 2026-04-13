import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OwnerSubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationProducerService } from './notification-producer.service';

@Injectable()
export class SubscriptionExpirySchedulerService {
  private readonly logger = new Logger(SubscriptionExpirySchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationProducerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async scanExpiring(): Promise<void> {
    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    const subs = await this.prisma.ownerSubscription.findMany({
      where: {
        status: OwnerSubscriptionStatus.ACTIVE,
        expiresAt: { gte: now, lte: soon },
      },
    });
    for (const sub of subs) {
      await this.notifications.enqueueSubscriptionExpiring({
        ownerSubscriptionId: sub.id,
        idempotencyKey: `reminder-${sub.id}-${sub.expiresAt.toISOString().slice(0, 10)}`,
      });
    }
    this.logger.log(`Queued ${subs.length} subscription reminder notifications`);
  }
}
