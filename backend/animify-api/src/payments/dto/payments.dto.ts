import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckoutDto {
  @ApiPropertyOptional({
    description: 'Plan pack id from GET /payments/plans (creator|pro|studio)',
    example: 'pro',
  })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  successUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}

export class PromoDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code: string;
}

export class WalletTopupDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  credits: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  successUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  cancelUrl?: string;
}
