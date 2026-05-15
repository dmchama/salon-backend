import { Module } from '@nestjs/common';
import { PlanGuardModule } from '../plan-guard/plan-guard.module';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { CloudinaryService } from './cloudinary.service';

@Module({
  imports: [PlanGuardModule],
  controllers: [GalleryController],
  providers: [GalleryService, CloudinaryService],
})
export class GalleryModule {}
