import { Module } from '@nestjs/common';
import { ServicesOfferedController } from './services-offered.controller';
import { ServicesOfferedService } from './services-offered.service';
import { ServicesRepository } from './repositories/services.repository';

@Module({
  controllers: [ServicesOfferedController],
  providers: [ServicesOfferedService, ServicesRepository],
  exports: [ServicesOfferedService],
})
export class ServicesOfferedModule {}
