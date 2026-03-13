import { Module } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Module({
  controllers: [BrandsController],
  providers: [BrandsService, JwtAuthGuard],
})
export class BrandsModule {}
