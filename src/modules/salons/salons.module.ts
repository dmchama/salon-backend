import { Module } from '@nestjs/common';
import { PlanGuardModule } from '../plan-guard/plan-guard.module';
import { GalleryModule } from '../gallery/gallery.module';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';
import { SalonsRepository } from './repositories/salons.repository';

@Module({
  imports: [PlanGuardModule, GalleryModule],
  controllers: [SalonsController],
  providers: [SalonsService, SalonsRepository],
  exports: [SalonsService, SalonsRepository],
})
export class SalonsModule {}
