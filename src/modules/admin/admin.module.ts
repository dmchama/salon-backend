import { Module } from '@nestjs/common';
import { AdminController, PublicWebsiteController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController, PublicWebsiteController],
  providers: [AdminService],
})
export class AdminModule {}
