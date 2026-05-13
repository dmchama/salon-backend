import { Injectable } from '@nestjs/common';
import { ConsoleEmailProvider } from './providers/console-email.provider';

@Injectable()
export class NotificationDispatcherService {
  constructor(private readonly email: ConsoleEmailProvider) {}

  async dispatchBookingConfirmation(email: string, salonName: string, startAt: Date): Promise<void> {
    await this.email.send(email, {
      title: 'Booking confirmation',
      body: `Your booking at ${salonName} is confirmed for ${startAt.toISOString()}`,
      metadata: { salonName, startAt: startAt.toISOString() },
    });
  }

  async dispatchBookingStatusUpdate(
    email: string,
    salonName: string,
    status: string,
  ): Promise<void> {
    await this.email.send(email, {
      title: 'Booking update',
      body: `Your booking at ${salonName} status is now: ${status}`,
      metadata: { status },
    });
  }

  async dispatchSubscriptionReminder(email: string, planName: string, expiresAt: Date): Promise<void> {
    await this.email.send(email, {
      title: 'Subscription expiring',
      body: `Your plan "${planName}" expires on ${expiresAt.toISOString()}`,
      metadata: { planName, expiresAt: expiresAt.toISOString() },
    });
  }

  async dispatchOverageInvoice(
    email: string,
    ownerName: string,
    invoice: {
      year: number;
      month: number;
      bookingLimit: number;
      totalBookings: number;
      overageCount: number;
      overagePriceCents: number;
      totalCents: number;
    },
  ): Promise<void> {
    const monthLabel = new Date(invoice.year, invoice.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const totalRs = (invoice.totalCents / 100).toFixed(2);
    const priceRs = (invoice.overagePriceCents / 100).toFixed(2);
    await this.email.send(email, {
      title: `Overage Invoice — ${monthLabel}`,
      body: [
        `Dear ${ownerName},`,
        ``,
        `Your account exceeded the included booking quota for ${monthLabel}.`,
        ``,
        `  Included bookings : ${invoice.bookingLimit}`,
        `  Total bookings    : ${invoice.totalBookings}`,
        `  Overage bookings  : ${invoice.overageCount}`,
        `  Rate per booking  : Rs. ${priceRs}`,
        `  Amount due        : Rs. ${totalRs}`,
        ``,
        `Please settle this invoice to avoid service interruption.`,
        ``,
        `Thank you,`,
        `GlamBook Platform`,
      ].join('\n'),
      metadata: { ...invoice },
    });
  }
}
