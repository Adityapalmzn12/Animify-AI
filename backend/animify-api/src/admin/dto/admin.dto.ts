import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType, UserRole, UserStatus } from '@prisma/client';

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class GrantCreditsDto {
  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'Support top-up' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class UpsertFeatureFlagDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  key: string;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateCouponDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty()
  discountValue: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxUses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  minAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  creditGrant?: number;

  @ApiProperty()
  validFrom: string;

  @ApiProperty()
  validUntil: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
