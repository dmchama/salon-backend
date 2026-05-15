import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NOTIFICATIONS_QUEUE } from '../../common/constants/queues';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationProducerService } from './notification-producer.service';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { ConsoleSmsProvider } from './providers/console-sms.provider';
import { ConsoleWhatsAppProvider } from './providers/console-whatsapp.provider';
import { SmslenzService } from './providers/smslenz.service';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  providers: [
    NotificationProducerService,
    NotificationDispatcherService,
    ConsoleEmailProvider,
    ConsoleSmsProvider,
    ConsoleWhatsAppProvider,
    SmslenzService,
  ],
  exports: [NotificationProducerService, NotificationDispatcherService, SmslenzService, BullModule],
})
export class NotificationsModule {}
