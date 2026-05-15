import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NOTIFICATIONS_QUEUE } from '../../common/constants/queues';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationProducerService } from './notification-producer.service';
import { NotificationProcessor } from './notification.processor';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { ConsoleSmsProvider } from './providers/console-sms.provider';
import { ConsoleWhatsAppProvider } from './providers/console-whatsapp.provider';
import { SmslenzService } from './providers/smslenz.service';
import { SubscriptionExpirySchedulerService } from './subscription-expiry.scheduler';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
        },
      }),
    }),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  providers: [
    NotificationProcessor,
    NotificationProducerService,
    NotificationDispatcherService,
    SubscriptionExpirySchedulerService,
    ConsoleEmailProvider,
    ConsoleSmsProvider,
    ConsoleWhatsAppProvider,
    SmslenzService,
  ],
})
export class NotificationsWorkerModule {}
