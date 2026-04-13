import { Module } from '@nestjs/common';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';
import { SalonsRepository } from './repositories/salons.repository';

@Module({
  controllers: [SalonsController],
  providers: [SalonsService, SalonsRepository],
  exports: [SalonsService, SalonsRepository],
})
export class SalonsModule {}
