import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobType } from '@prisma/client';

export class CreateVideoJobDto {
  @ApiPropertyOptional({ description: 'Input file ID (required for stylize/I2V)' })
  @IsOptional()
  @IsString()
  inputFileId?: string;

  @ApiPropertyOptional({ description: 'Template ID or style slug' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ enum: JobType, default: JobType.STYLIZE })
  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional({ description: 'Additional settings for the job' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
