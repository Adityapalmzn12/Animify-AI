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

export class AdjustCreditsDto {
  @ApiPropertyOptional({
    description: 'Positive to add, negative to remove (fix mistaken grants)',
    example: -50,
  })
  @IsOptional()
  @IsInt()
  delta?: number;

  @ApiPropertyOptional({
    description: 'Set absolute wallet balance',
    example: 200,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  setTo?: number;

  @ApiProperty({ example: 'Corrected mistaken grant' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}

export class UpdatePricingDto {
  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  marginPercent?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  retailCreditInr?: number;

  @ApiPropertyOptional({
    description: 'Override user credit prices per action key',
  })
  @IsOptional()
  @IsObject()
  costs?: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Provider INR cost estimates; used when recomputeFromProviderCosts=true',
  })
  @IsOptional()
  @IsObject()
  providerCosts?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recomputeFromProviderCosts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  plans?: Array<{
    id: string;
    name: string;
    priceInr: number;
    credits: number;
    description: string;
    popular?: boolean;
    stripePriceId?: string | null;
  }>;

  @ApiPropertyOptional({
    description: 'Quality tiers (economy/standard/premium) with credits + models',
  })
  @IsOptional()
  tiers?: Array<{
    id: string;
    name: string;
    tagline: string;
    default?: boolean;
    videoModelT2v: string;
    videoModelI2v: string;
    imageModel: string;
    engine: string;
    storyCredits: { 10: number; 30: number; 60: number };
    imageCredits: number;
  }>;
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
