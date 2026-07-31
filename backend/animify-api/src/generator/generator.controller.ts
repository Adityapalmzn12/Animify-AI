import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GeneratorService } from './generator.service';
import { CreateGeneratorJobDto } from './dto/create-generator-job.dto';

@ApiTags('generator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('generator')
export class GeneratorController {
  constructor(private readonly generator: GeneratorService) {}

  @Get('providers')
  @ApiOperation({ summary: 'List configured AI providers' })
  providers() {
    return this.generator.providers();
  }

  @Get('estimate')
  @ApiOperation({ summary: 'Estimate credit cost for a job type' })
  estimate(@Query('jobType') jobType = 'TEXT_TO_VIDEO') {
    return this.generator.estimate(jobType);
  }

  @Post()
  @ApiOperation({ summary: 'Create text-to-video or image-to-video job' })
  create(@CurrentUser() user: any, @Body() dto: CreateGeneratorJobDto) {
    return this.generator.create(user.id, dto);
  }
}
