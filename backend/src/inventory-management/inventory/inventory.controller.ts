import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory-items')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post()
  create(@Body() data: Record<string, unknown>) {
    return this.service.create(data);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.service.update(+id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  @Get('alerts/low-stock')
  lowStockAlerts() {
    return this.service.lowStockAlerts();
  }
}