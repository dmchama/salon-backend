import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'owner@salon.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'SecurePass1' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: [Role.CUSTOMER, Role.OWNER] })
  @IsIn([Role.CUSTOMER, Role.OWNER])
  role!: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  /** Required when role is OWNER — links the initial subscription after signup (plan primary key, may be UUID or custom id e.g. from seed). */
  @ApiPropertyOptional({ description: 'Subscription plan id (required for OWNER)' })
  @ValidateIf((o) => o.role === Role.OWNER)
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  subscriptionPlanId?: string;
}
