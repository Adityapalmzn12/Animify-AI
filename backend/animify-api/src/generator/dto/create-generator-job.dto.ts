import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType } from '@prisma/client';

export class CreateGeneratorJobDto {
  @ApiProperty({ enum: [JobType.TEXT_TO_VIDEO, JobType.IMAGE_TO_VIDEO, JobType.STYLIZE] })
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
