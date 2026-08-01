import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateCouponDto,
  GrantCreditsDto,
  UpdateAdminUserDto,
  UpsertFeatureFlagDto,
} from './dto/admin.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('metrics')
  metrics() {
    return this.admin.metrics();
  }

  @Get('users')
  users(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.admin.listUsers(parseInt(page, 10), parseInt(limit, 10));
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.admin.updateUser(id, dto);
  }

  @Post('users/:id/credits')
  grantCredits(@Param('id') id: string, @Body() dto: GrantCreditsDto) {
    return this.admin.grantCredits(id, dto);
  }

  @Get('subscriptions')
  subscriptions(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.admin.listSubscriptions(parseInt(page, 10), parseInt(limit, 10));
  }

  @Get('jobs')
  jobs(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.admin.listJobs(
      parseInt(page, 10),
      parseInt(limit, 10),
      status,
    );
  }

  @Get('payments')
  payments(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.admin.listPayments(parseInt(page, 10), parseInt(limit, 10));
  }

  @Get('feature-flags')
  featureFlags() {
    return this.admin.listFeatureFlags();
  }

  @Post('feature-flags')
  upsertFeatureFlag(@Body() dto: UpsertFeatureFlagDto) {
    return this.admin.upsertFeatureFlag(dto);
  }

  @Get('coupons')
  coupons() {
    return this.admin.listCoupons();
  }

  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.admin.createCoupon(dto);
  }

  @Get('providers')
  providers() {
    return this.admin.listProviders();
  }

  @Get('audit-logs')
  auditLogs(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.admin.auditLogs(parseInt(page, 10), parseInt(limit, 10));
  }
}
