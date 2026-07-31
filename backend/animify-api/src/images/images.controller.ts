import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ImagesService } from './images.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BgRemoveDto, GenerateImageDto } from './dto/images.dto';

@ApiTags('images')
@ApiBearerAuth()
@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post('generate')
  generate(@CurrentUser('id') userId: string, @Body() dto: GenerateImageDto) {
    return this.images.generate(userId, dto);
  }

  @Post('bg-remove')
  bgRemove(@CurrentUser('id') userId: string, @Body() dto: BgRemoveDto) {
    return this.images.bgRemove(userId, dto);
  }

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.images.list(userId, parseInt(page, 10), parseInt(limit, 10));
  }
}
