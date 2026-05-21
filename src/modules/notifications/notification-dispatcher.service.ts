import { Injectable } from '@nestjs/common';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { SmslenzService } from './providers/smslenz.service';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo',
  });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Colombo',
  });
}

@Injectable()
export class NotificationDispatcherService {
  constructor(
    private readonly email: ConsoleEmailProvider,
    private readonly sms: SmslenzService,
  ) {}

  async dispatchBookingConfirmation(email: string, salonName: string, startAt: Date): Promise<void> {
    await this.email.send(email, {
      title: 'Booking confirmation',
      body: `Your booking at ${salonName} is confirmed for ${startAt.toISOString()}`,
      metadata: { salonName, startAt: startAt.toISOString() },
    });
  }

  async dispatchBookingConfirmationSms(
    phone: string,
    guestName: string,
    salonName: string,
    serviceName: string,
    startAt: Date,
    salonPhone?: string,
  ): Promise<void> {
    const lines = [
      `Hi ${guestName},`,
      `Your ${serviceName} booking is confirmed.`,
      `Date: ${fmtDate(startAt)}`,
      `Time: ${fmtTime(startAt)}`,
      salonName,
    ];
    if (salonPhone) lines.push(`Contact: ${salonPhone}`);
    await this.sms.sendBulkSms([phone], lines.join('\n'));
  }

  async dispatchBookingCancellationSms(
    phone: string,
    guestName: string,
    salonName: string,
    startAt: Date,
    salonPhone?: string,
  ): Promise<void> {
    const message = [
      `Hi ${guestName},`,
      `Your booking at ${salonName} has been cancelled.`,
      `Date: ${fmtDate(startAt)}`,
      `Time: ${fmtTime(startAt)}`,
      salonPhone ? `To rebook, call us: ${salonPhone}` : `Please contact us to rebook.`,
    ].join('\n');
    await this.sms.sendBulkSms([phone], message);
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
