import { Injectable, Logger } from '@nestjs/common';
import { EmailNotificationProvider, NotificationContext } from '../interfaces/notification-channel.interface';

@Injectable()
export class ConsoleEmailProvider implements EmailNotificationProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(to: string, ctx: NotificationContext): Promise<void> {
    this.logger.log(`[EMAIL stub] to=${to} title=${ctx.title} body=${ctx.body}`);
  }
}
