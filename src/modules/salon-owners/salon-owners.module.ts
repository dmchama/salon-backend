import { Module } from '@nestjs/common';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SalonOwnersController } from './salon-owners.controller';
import { SalonOwnersService } from './salon-owners.service';

@Module({
  imports: [PromoCodesModule, NotificationsModule],
  controllers: [SalonOwnersController],
  providers: [SalonOwnersService],
})
export class SalonOwnersModule {}
