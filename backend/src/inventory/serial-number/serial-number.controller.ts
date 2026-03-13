import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SerialNumberService } from './serial-number.service';
import { CreateSerialNumberDto } from './dto/create-serial-number.dto';
import { UpdateSerialNumberDto } from './dto/update-serial-number.dto';
import { ScanSalesOrderDto } from './dto/scan-sales-order.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('serial-number')
@UseGuards(JwtAuthGuard)
export class SerialNumberController {
  constructor(private readonly serialNumberService: SerialNumberService) {}

  @Post('scan-sales-order')
  scanSalesOrder(
    @Body() dto: ScanSalesOrderDto,
    @Req() request: { user?: { sub?: unknown } },
  ) {
    const userId = Number(request.user?.sub);
    const normalizedUserId = Number.isFinite(userId) ? userId : undefined;

    return this.serialNumberService.scanSalesOrder(dto, normalizedUserId);
  }

  @Post()
  create(@Body() createSerialNumberDto: CreateSerialNumberDto) {
    return this.serialNumberService.create(createSerialNumberDto);
  }

  @Get()
  findAll() {
    return this.serialNumberService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serialNumberService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSerialNumberDto: UpdateSerialNumberDto) {
    return this.serialNumberService.update(+id, updateSerialNumberDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serialNumberService.remove(+id);
  }
}
