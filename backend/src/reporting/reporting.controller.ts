import { Controller, Get } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { convertBigIntToString } from '../utils/bigint-serializer';

@Controller('reports')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('summary')
  async getSummary() {
    const result = await this.service.getSummary();
    return convertBigIntToString(result);
  }
}