import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.sale.create({ data: data as never });
  }

  findAll() {
    return this.prisma.sale.findMany({
      include: { jobOrder: true, inventory: true, invoice: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.sale.findUnique({ where: { id }, include: { jobOrder: true, inventory: true, invoice: true } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.sale.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.sale.delete({ where: { id } });
  }
}