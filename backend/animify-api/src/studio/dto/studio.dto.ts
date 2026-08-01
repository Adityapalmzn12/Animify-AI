import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum CreativeMode {
  LOGO = 'logo',
  FASHION = 'fashion',
  GHIBLI = 'ghibli',
  ANIME = 'anime',
  PRODUCT = 'product',
  THUMBNAIL = 'thumbnail',
  BRAND_KIT = 'brand_kit',
  POSTER = 'poster',
  PROMPT_TO_VIDEO = 'prompt_to_video',
  STORY_REEL = 'story_reel',
  CHARACTER = 'character',
  INTERIOR = 'interior',
  PPT = 'ppt',
}

export const STYLE_PROMPTS: Record<CreativeMode, string> = {
  [CreativeMode.LOGO]:
    'Professional company logo design, vector-style, clean, memorable mark, centered, transparent or solid background, no mockup clutter, brand identity',
  [CreativeMode.FASHION]:
    'High-fashion clothing design concept, runway lookbook photo, designer apparel, fabric detail, editorial fashion photography',
  [CreativeMode.GHIBLI]:
    'Studio Ghibli inspired illustration, soft watercolor lighting, whimsical, hand-painted anime background aesthetic, Hayao Miyazaki style',
  [CreativeMode.ANIME]:
    'Premium anime illustration, vibrant colors, detailed character design, cinematic lighting, modern anime key visual',
  [CreativeMode.PRODUCT]:
    'Premium product photography, studio lighting, commercial catalog shot, crisp reflections, e-commerce ready',
  [CreativeMode.THUMBNAIL]:
    'Bold YouTube thumbnail composition, high contrast, expressive face or focal subject, readable layout space, viral CTR style',
  [CreativeMode.BRAND_KIT]:
    'Brand identity hero visual with logo mark concept, cohesive color story, modern startup branding, clean presentation',
  [CreativeMode.POSTER]:
    'Marketing poster / ad creative, strong hierarchy, dramatic composition, advertising campaign quality',
  [CreativeMode.PROMPT_TO_VIDEO]:
    'Cinematic short film scene, smooth motion, dramatic lighting',
  [CreativeMode.STORY_REEL]:
    'Vertical social story reel scene, emotional storytelling, dynamic camera move',
  [CreativeMode.CHARACTER]:
    'Original character / mascot IP design, full body, distinctive silhouette, merchandise-ready, clean background',
  [CreativeMode.INTERIOR]:
    'Interior design concept visualization, architectural photography, beautiful lighting, magazine quality',
  [CreativeMode.PPT]:
    'Professional presentation deck, clear hierarchy, business storytelling, actionable slides',
};

export class CreateStudioDto {
  @ApiProperty({ enum: CreativeMode })
  @IsEnum(CreativeMode)
  mode: CreativeMode;

  @ApiProperty({ example: 'A fox mascot for a coffee brand named Ember' })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt: string;

  @ApiPropertyOptional({ example: 'Ember Coffee' })
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiPropertyOptional({ example: ['#1A1A1A', '#E85D04'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];

  @ApiPropertyOptional({ description: 'Extra style hint' })
  @IsOptional()
  @IsString()
  style?: string;

  @ApiPropertyOptional({ description: '9:16 | 16:9 | 1:1' })
  @IsOptional()
  @IsString()
  aspect?: string;

  @ApiPropertyOptional({
    description: 'Target video length in seconds (10 | 30 | 60)',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(60)
  duration?: number;

  @ApiPropertyOptional({
    description: 'Character / reference image file IDs for consistent cast',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  characterImageFileIds?: string[];

  @ApiPropertyOptional({
    description: 'After image gen, also create image-to-video',
  })
  @IsOptional()
  @IsBoolean()
  animate?: boolean;

  @ApiPropertyOptional({ description: 'Mux narration audio onto story video' })
  @IsOptional()
  @IsBoolean()
  addAudio?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
