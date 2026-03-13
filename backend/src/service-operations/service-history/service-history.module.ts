import { Module } from '@nestjs/common';
import { ServiceHistoryController } from './service-history.controller';
import { ServiceHistoryService } from './service-history.service';

@Module({
  controllers: [ServiceHistoryController],
  providers: [ServiceHistoryService],
})
export class ServiceHistoryModule {}