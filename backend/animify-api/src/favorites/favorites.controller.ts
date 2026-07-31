import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FavoritesService } from './favorites.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FavoriteDto } from './dto/favorites.dto';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller()
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get('favorites')
  list(@CurrentUser('id') userId: string) {
    return this.favorites.list(userId);
  }

  @Post('favorites')
  add(@CurrentUser('id') userId: string, @Body() dto: FavoriteDto) {
    return this.favorites.add(userId, dto.videoJobId);
  }

  @Delete('favorites/:videoJobId')
  remove(
    @CurrentUser('id') userId: string,
    @Param('videoJobId') videoJobId: string,
  ) {
    return this.favorites.remove(userId, videoJobId);
  }

  @Get('history')
  history(
    @CurrentUser('id') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.favorites.history(
      userId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post('downloads/:jobId')
  download(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
    @Req() req: Request,
  ) {
    return this.favorites.recordDownload(
      userId,
      jobId,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
