import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.inventory.create({ data: data as never });
  }

  findAll() {
    return this.prisma.inventory.findMany({ include: { supplier: true }, orderBy: { id: 'desc' } });
  }

  findOne(id: number) {
    return this.prisma.inventory.findUnique({ where: { id }, include: { supplier: true } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.inventory.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.inventory.delete({ where: { id } });
  }

  async lowStockAlerts() {
    const items = await this.prisma.$queryRaw`
      SELECT *
      FROM inventory
      WHERE stock_qty <= low_stock_threshold
      ORDER BY stock_qty ASC
    `;

    return items;
  }
}