import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SalonOwnersModule } from './modules/salon-owners/salon-owners.module';
import { SalonsModule } from './modules/salons/salons.module';
import { ServicesOfferedModule } from './modules/services-offered/services-offered.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { SubscriptionPlansModule } from './modules/subscription-plans/subscription-plans.module';
import { OwnerSubscriptionsModule } from './modules/owner-subscriptions/owner-subscriptions.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { SearchModule } from './modules/search/search.module';
import { TechniciansModule } from './modules/technicians/technicians.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('logLevel') ?? 'info',
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
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
    PrismaModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    SalonOwnersModule,
    SalonsModule,
    ServicesOfferedModule,
    BookingsModule,
    SubscriptionPlansModule,
    OwnerSubscriptionsModule,
    GalleryModule,
    AdminModule,
    SearchModule,
    TechniciansModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
