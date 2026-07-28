import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { VideosService } from './videos.service';
import { CreateVideoJobDto } from './dto/create-video-job.dto';
import { GetUploadUrlDto } from './dto/get-upload-url.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

@ApiTags('videos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  @ApiOperation({ summary: 'Get all video jobs for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getVideoJobs(
    @CurrentUser() user: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.videosService.getVideoJobs(user.id, page || 1, limit || 10, status);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent video jobs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentVideos(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ) {
    return this.videosService.getRecentVideos(user.id, limit || 5);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific video job' })
  async getVideoJob(@CurrentUser() user: any, @Param('id') id: string) {
    return this.videosService.getVideoJob(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new video job' })
  async createVideoJob(
    @CurrentUser() user: any,
    @Body() dto: CreateVideoJobDto,
  ) {
    return this.videosService.createVideoJob(user.id, dto);
  }

  @Post('upload-url')
  @ApiOperation({ summary: 'Get a presigned upload URL' })
  async getUploadUrl(@CurrentUser() user: any, @Body() dto: GetUploadUrlDto) {
    return this.videosService.getUploadUrl(user.id, dto.fileName, dto.mimeType);
  }

  @Post('confirm-upload')
  @ApiOperation({ summary: 'Confirm file upload completion' })
  async confirmUpload(@CurrentUser() user: any, @Body() dto: ConfirmUploadDto) {
    return this.videosService.confirmUpload(
      user.id,
      dto.fileId,
      dto.fileName,
      dto.fileSize,
      dto.mimeType,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a video job' })
  async cancelVideoJob(@CurrentUser() user: any, @Param('id') id: string) {
    return this.videosService.cancelVideoJob(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a video job' })
  async deleteVideoJob(@CurrentUser() user: any, @Param('id') id: string) {
    return this.videosService.deleteVideoJob(user.id, id);
  }
}
