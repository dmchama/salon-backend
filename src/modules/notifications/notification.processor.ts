import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { NOTIFICATIONS_QUEUE, NotificationJobName } from '../../common/constants/queues';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  BookingNotificationPayload,
  RegistrationPaymentReviewedPayload,
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
      case NotificationJobName.RegistrationPaymentApproved:
      case NotificationJobName.RegistrationPaymentRejected:
        await this.handleRegistrationPaymentReviewed(job.data as RegistrationPaymentReviewedPayload);
        return;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleBookingCreated(data: BookingNotificationPayload): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { customer: true, salon: true, service: true },
    });
    if (!booking) {
      this.logger.warn(`Booking ${data.bookingId} not found for notification`);
      return;
    }

    const email = booking.customer?.email ?? booking.guestEmail;
    if (email) {
      await this.dispatcher.dispatchBookingConfirmation(email, booking.salon.name, booking.startAt);
    }

    const phone = booking.guestPhone;
    const name = booking.guestName ?? booking.customer?.firstName ?? 'Customer';
    if (phone) {
      await this.dispatcher.dispatchBookingConfirmationSms(
        phone,
        name,
        booking.salon.name,
        booking.service.name,
        booking.startAt,
      );
    }
  }

  private async handleBookingStatusUpdated(data: BookingNotificationPayload): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { customer: true, salon: true, service: true },
    });
    if (!booking) {
      this.logger.warn(`Booking ${data.bookingId} not found for notification`);
      return;
    }

    const email = booking.customer?.email ?? booking.guestEmail;
    if (email) {
      await this.dispatcher.dispatchBookingStatusUpdate(email, booking.salon.name, booking.status);
    }

    // Send SMS only on cancellation
    const phone = booking.guestPhone;
    const name = booking.guestName ?? booking.customer?.firstName ?? 'Customer';
    if (phone && booking.status === BookingStatus.CANCELLED) {
      await this.dispatcher.dispatchBookingCancellationSms(
        phone,
        name,
        booking.salon.name,
        booking.startAt,
      );
    }
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

  private async handleRegistrationPaymentReviewed(data: RegistrationPaymentReviewedPayload): Promise<void> {
    const payment = await this.prisma.registrationPayment.findUnique({
      where: { id: data.registrationPaymentId },
      include: { owner: true },
    });
    if (!payment || payment.status === 'PENDING') {
      this.logger.warn(`RegistrationPayment ${data.registrationPaymentId} not found or not reviewed`);
      return;
    }
    const name = payment.owner.firstName ?? 'there';
    if (payment.status === 'APPROVED') {
      await this.dispatcher.dispatchRegistrationApproved(payment.owner.email, name, payment.owner.phone);
    } else {
      await this.dispatcher.dispatchRegistrationRejected(
        payment.owner.email,
        name,
        payment.rejectionReason ?? '',
        payment.owner.phone,
      );
    }
  }
}
