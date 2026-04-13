import { Injectable, Logger } from '@nestjs/common';
import { NotificationContext, SmsNotificationProvider } from '../interfaces/notification-channel.interface';

@Injectable()
export class ConsoleSmsProvider implements SmsNotificationProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(toPhone: string, ctx: NotificationContext): Promise<void> {
    this.logger.log(`[SMS stub] to=${toPhone} title=${ctx.title}`);
  }
}
