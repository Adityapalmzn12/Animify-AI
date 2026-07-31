import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ImageStyle {
  REALISTIC = 'realistic',
  ANIME = 'anime',
  CARTOON = 'cartoon',
  PIXAR = 'pixar',
  GHIBLI = 'ghibli',
  THREE_D = '3d',
}

export class GenerateImageDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt: string;

  @ApiProperty({ enum: ImageStyle })
  @IsEnum(ImageStyle)
  style: ImageStyle;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class BgRemoveDto {
  @ApiProperty()
  @IsUUID()
  inputFileId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
