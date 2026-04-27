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

/** Self-service registration is only for salon admins (business accounts). Super admins are created manually or via seed. */
export class RegisterDto {
  @ApiProperty({ example: 'owner@salon.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'SecurePass1' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: [Role.SALON_ADMIN] })
  @IsIn([Role.SALON_ADMIN])
  role!: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  /** Required when registering as SALON_ADMIN — subscription plan id from seed or admin-created plans. */
  @ApiPropertyOptional({ description: 'Subscription plan id (required for SALON_ADMIN)' })
  @ValidateIf((o) => o.role === Role.SALON_ADMIN)
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  subscriptionPlanId?: string;
}
