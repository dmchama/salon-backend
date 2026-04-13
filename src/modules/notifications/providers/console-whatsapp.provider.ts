import { Injectable, Logger } from '@nestjs/common';
import { NotificationContext, WhatsAppNotificationProvider } from '../interfaces/notification-channel.interface';

@Injectable()
export class ConsoleWhatsAppProvider implements WhatsAppNotificationProvider {
  private readonly logger = new Logger(ConsoleWhatsAppProvider.name);

  async send(toPhone: string, ctx: NotificationContext): Promise<void> {
    this.logger.log(`[WhatsApp stub] to=${toPhone} title=${ctx.title}`);
  }
}
