import { Module } from '@nestjs/common';
import { SalonOwnersController } from './salon-owners.controller';
import { SalonOwnersService } from './salon-owners.service';

@Module({
  controllers: [SalonOwnersController],
  providers: [SalonOwnersService],
})
export class SalonOwnersModule {}
