import { Module } from '@nestjs/common';
import { PlanGuardModule } from '../plan-guard/plan-guard.module';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { CloudinaryModule } from '../../common/cloudinary/cloudinary.module';

@Module({
  imports: [PlanGuardModule, CloudinaryModule],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
