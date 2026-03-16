import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { convertBigIntToString } from '../utils/bigint-serializer';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Post()
  async create(@Body() data: Record<string, unknown>) {
    const result = await this.service.create(data);
    return convertBigIntToString(result);
  }

  @Get()
  async findAll() {
    const result = await this.service.findAll();
    return convertBigIntToString(result);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.service.findOne(+id);
    return convertBigIntToString(result);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    const result = await this.service.update(+id, data);
    return convertBigIntToString(result);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}