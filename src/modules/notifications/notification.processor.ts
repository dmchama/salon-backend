import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATIONS_QUEUE, NotificationJobName } from '../../common/constants/queues';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  BookingNotificationPayload,
  SubscriptionReminderPayload,
} from './notification-producer.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NotificationJobName.BookingCreated:
        await this.handleBookingCreated(job.data as BookingNotificationPayload);
        return;
      case NotificationJobName.BookingStatusUpdated:
        await this.handleBookingStatusUpdated(job.data as BookingNotificationPayload);
        return;
      case NotificationJobName.SubscriptionExpiring:
        await this.handleSubscriptionExpiring(job.data as SubscriptionReminderPayload);
        return;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleBookingCreated(data: BookingNotificationPayload): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: {
        customer: true,
        salon: true,
      },
    });
    if (!booking) {
      this.logger.warn(`Booking ${data.bookingId} not found for notification`);
      return;
    }
    await this.dispatcher.dispatchBookingConfirmation(
      booking.customer.email,
      booking.salon.name,
      booking.startAt,
    );
  }

  private async handleBookingStatusUpdated(data: BookingNotificationPayload): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: {
        customer: true,
        salon: true,
      },
    });
    if (!booking) {
      this.logger.warn(`Booking ${data.bookingId} not found for notification`);
      return;
    }
    await this.dispatcher.dispatchBookingStatusUpdate(
      booking.customer.email,
      booking.salon.name,
      booking.status,
    );
  }

  private async handleSubscriptionExpiring(data: SubscriptionReminderPayload): Promise<void> {
    const sub = await this.prisma.ownerSubscription.findUnique({
      where: { id: data.ownerSubscriptionId },
      include: { owner: true, plan: true },
    });
    if (!sub) {
      this.logger.warn(`OwnerSubscription ${data.ownerSubscriptionId} not found`);
      return;
    }
    await this.dispatcher.dispatchSubscriptionReminder(
      sub.owner.email,
      sub.plan.name,
      sub.expiresAt,
    );
  }
}
