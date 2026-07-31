import { IsString, IsOptional, MinLength, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fcmToken?: string;
}
