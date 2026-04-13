import { Module } from '@nestjs/common';
import { OwnerSubscriptionsController } from './owner-subscriptions.controller';
import { OwnerSubscriptionsService } from './owner-subscriptions.service';

@Module({
  controllers: [OwnerSubscriptionsController],
  providers: [OwnerSubscriptionsService],
})
export class OwnerSubscriptionsModule {}
