import { Module } from '@nestjs/common';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';
import { AdminController, PublicWebsiteController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PromoCodesModule],
  controllers: [AdminController, PublicWebsiteController],
  providers: [AdminService],
})
export class AdminModule {}
