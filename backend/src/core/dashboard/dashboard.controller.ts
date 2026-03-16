import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { convertBigIntToString } from '../../utils/bigint-serializer';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview() {
    const result = await this.dashboardService.getOverview();
    return convertBigIntToString(result);
  }
}