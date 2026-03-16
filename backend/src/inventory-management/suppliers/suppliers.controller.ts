import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { convertBigIntToString } from '../../utils/bigint-serializer';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

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
  async remove(@Param('id') id: string) {
    const result = await this.service.remove(+id);
    return convertBigIntToString(result);
  }
}