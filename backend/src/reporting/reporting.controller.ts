import { Controller, Get } from '@nestjs/common';
import { ReportingService } from './reporting.service';

@Controller('reports')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('summary')
  getSummary() {
    return this.service.getSummary();
  }
}