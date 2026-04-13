import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { NOTIFICATIONS_QUEUE, NotificationJobName } from '../../common/constants/queues';

export type BookingNotificationPayload = {
  bookingId: string;
  idempotencyKey: string;
};

export type SubscriptionReminderPayload = {
  ownerSubscriptionId: string;
  idempotencyKey: string;
};

@Injectable()
export class NotificationProducerService {
  private readonly logger = new Logger(NotificationProducerService.name);

  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue) {}

  async enqueueBookingCreated(payload: BookingNotificationPayload): Promise<void> {
    await this.queue.add(NotificationJobName.BookingCreated, payload, {
      jobId: payload.idempotencyKey,
      removeOnComplete: true,
    });
    this.logger.debug(`Queued ${NotificationJobName.BookingCreated} ${payload.bookingId}`);
  }

  async enqueueBookingStatusUpdated(payload: BookingNotificationPayload): Promise<void> {
    await this.queue.add(NotificationJobName.BookingStatusUpdated, payload, {
      jobId: payload.idempotencyKey,
      removeOnComplete: true,
    });
    this.logger.debug(`Queued ${NotificationJobName.BookingStatusUpdated} ${payload.bookingId}`);
  }

  async enqueueSubscriptionExpiring(payload: SubscriptionReminderPayload): Promise<void> {
    await this.queue.add(NotificationJobName.SubscriptionExpiring, payload, {
      jobId: payload.idempotencyKey,
      removeOnComplete: true,
    });
    this.logger.debug(`Queued ${NotificationJobName.SubscriptionExpiring} ${payload.ownerSubscriptionId}`);
  }
}
