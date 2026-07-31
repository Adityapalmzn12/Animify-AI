import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ScriptsService } from './scripts.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GenerateScriptDto } from './dto/scripts.dto';

@ApiTags('scripts')
@ApiBearerAuth()
@Controller('scripts')
export class ScriptsController {
  constructor(private readonly scripts: ScriptsService) {}

  @Post('generate')
  generate(@CurrentUser('id') userId: string, @Body() dto: GenerateScriptDto) {
    return this.scripts.generate(userId, dto);
  }

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.scripts.list(userId, parseInt(page, 10), parseInt(limit, 10));
  }
}
