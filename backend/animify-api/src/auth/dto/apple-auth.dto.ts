import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class AppleAuthDto {
  @ApiProperty()
  @IsString()
  identityToken: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;
}
