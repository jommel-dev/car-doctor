import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SalesOrderService } from './sales-order.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';

@Controller('sales-order')
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  @Post()
  create(@Body() createSalesOrderDto: CreateSalesOrderDto) {
    return this.salesOrderService.create(createSalesOrderDto);
  }

  @Get()
  findAll() {
    return this.salesOrderService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesOrderService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSalesOrderDto: UpdateSalesOrderDto) {
    return this.salesOrderService.update(+id, updateSalesOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.salesOrderService.remove(+id);
  }
}
