import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType } from '@prisma/client';

export class CreateGeneratorJobDto {
  @ApiProperty({
    enum: [JobType.TEXT_TO_VIDEO, JobType.IMAGE_TO_VIDEO, JobType.STYLIZE],
  })
  @IsEnum(JobType)
  jobType: JobType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  prompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inputFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: '9:16 | 16:9 | 1:1' })
  @IsOptional()
  @IsString()
  aspect?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  style?: string;

  @ApiPropertyOptional({
    description: 'Target video length in seconds (15 | 30 | 59)',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(59)
  duration?: number;

  @ApiPropertyOptional({
    description: 'Generate narration voice (default true for video jobs)',
  })
  @IsOptional()
  @IsBoolean()
  addAudio?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
