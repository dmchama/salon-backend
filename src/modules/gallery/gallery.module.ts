import { Module } from '@nestjs/common';
import { PlanGuardModule } from '../plan-guard/plan-guard.module';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  imports: [PlanGuardModule],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
