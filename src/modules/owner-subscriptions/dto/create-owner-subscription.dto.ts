import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateOwnerSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;
}
