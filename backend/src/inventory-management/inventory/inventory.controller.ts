import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { convertBigIntToString } from '../../utils/bigint-serializer';

@Controller('inventory-items')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post()
  async create(@Body() data: Record<string, unknown>) {
    const result = await this.service.create(data);
    return convertBigIntToString(result);
  }

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('supplierId') supplierId?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    const result = await this.service.findAll({
      search,
      supplierId,
      lowStock,
    });
    return convertBigIntToString(result);
  }

  @Get('alerts/low-stock')
  async lowStockAlerts() {
    const result = await this.service.lowStockAlerts();
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