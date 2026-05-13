import { Module } from '@nestjs/common';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminController, PublicWebsiteController } from './admin.controller';
import { AdminService } from './admin.service';
import { OverageService } from './overage.service';

@Module({
  imports: [PromoCodesModule, NotificationsModule],
  controllers: [AdminController, PublicWebsiteController],
  providers: [AdminService, OverageService],
})
export class AdminModule {}
