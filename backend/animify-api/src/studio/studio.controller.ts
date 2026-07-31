import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StudioService } from './studio.service';
import { CreateStudioDto } from './dto/studio.dto';

@ApiTags('studio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('studio')
export class StudioController {
  constructor(private readonly studio: StudioService) {}

  @Get('modes')
  @ApiOperation({ summary: 'List Creative Studio modes' })
  modes() {
    return this.studio.modes();
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generate logo, fashion, Ghibli, product, video, and more',
  })
  generate(@CurrentUser() user: any, @Body() dto: CreateStudioDto) {
    return this.studio.create(user.id, dto);
  }
}
