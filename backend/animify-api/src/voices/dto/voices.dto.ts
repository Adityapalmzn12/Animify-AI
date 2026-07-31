import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TtsDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class CloneVoiceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  previewUrl?: string;
}

export class VoiceJobDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inputFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  settings?: Record<string, unknown>;
}
