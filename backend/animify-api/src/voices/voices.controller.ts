import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VoicesService } from './voices.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CloneVoiceDto, TtsDto, VoiceJobDto } from './dto/voices.dto';

@ApiTags('voices')
@ApiBearerAuth()
@Controller('voices')
export class VoicesController {
  constructor(private readonly voices: VoicesService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.voices.listVoices(userId);
  }

  @Post('tts')
  tts(@CurrentUser('id') userId: string, @Body() dto: TtsDto) {
    return this.voices.synthesizeTts(userId, dto);
  }

  @Post('clone')
  clone(@CurrentUser('id') userId: string, @Body() dto: CloneVoiceDto) {
    return this.voices.cloneVoice(userId, dto);
  }

  @Post('avatar')
  avatar(@CurrentUser('id') userId: string, @Body() dto: VoiceJobDto) {
    return this.voices.createAvatarJob(userId, dto);
  }

  @Post('dub')
  dub(@CurrentUser('id') userId: string, @Body() dto: VoiceJobDto) {
    return this.voices.createDubJob(userId, dto);
  }

  @Post('subtitles')
  subtitles(@CurrentUser('id') userId: string, @Body() dto: VoiceJobDto) {
    return this.voices.createSubtitleJob(userId, dto);
  }
}
