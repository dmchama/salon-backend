import { Module } from '@nestjs/common';
import { PlanGuardService } from './plan-guard.service';

@Module({
  providers: [PlanGuardService],
  exports: [PlanGuardService],
})
export class PlanGuardModule {}
