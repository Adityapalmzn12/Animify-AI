import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ScriptType {
  STORY = 'story',
  YOUTUBE = 'youtube',
  ADS = 'ads',
  REEL = 'reel',
  SCENE = 'scene',
  PODCAST = 'podcast',
}

export class GenerateScriptDto {
  @ApiProperty({ enum: ScriptType })
  @IsEnum(ScriptType)
  type: ScriptType;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tone?: string;

  @ApiPropertyOptional({ description: 'short | medium | long' })
  @IsOptional()
  @IsString()
  length?: string;
}
