import { Module } from '@nestjs/common';
import { PlanGuardModule } from '../plan-guard/plan-guard.module';
import { CloudinaryModule } from '../../common/cloudinary/cloudinary.module';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';
import { SalonsRepository } from './repositories/salons.repository';

@Module({
  imports: [PlanGuardModule, CloudinaryModule],
  controllers: [SalonsController],
  providers: [SalonsService, SalonsRepository],
  exports: [SalonsService, SalonsRepository],
})
export class SalonsModule {}
