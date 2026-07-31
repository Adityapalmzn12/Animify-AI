import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Credits')
@ApiBearerAuth()
@Controller('credits')
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get('balance')
  balance(@CurrentUser('id') userId: string) {
    return this.credits.getBalance(userId);
  }

  @Get('ledger')
  ledger(
    @CurrentUser('id') userId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.credits.listLedger(userId, parseInt(page, 10), parseInt(limit, 10));
  }
}
