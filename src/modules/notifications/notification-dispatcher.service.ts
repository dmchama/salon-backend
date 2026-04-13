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
}
