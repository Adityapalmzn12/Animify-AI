import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVideoJobDto {
  @ApiProperty({ description: 'Input file ID' })
  @IsString()
  inputFileId: string;

  @ApiPropertyOptional({ description: 'Template ID to use for animation' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Additional settings for the job' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
