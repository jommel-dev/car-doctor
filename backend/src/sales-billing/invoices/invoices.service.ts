import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.invoice.create({ data: data as never });
  }

  findAll() {
    return this.prisma.invoice.findMany({
      include: { customer: true, jobOrder: true, sales: true, receivable: true },
      orderBy: { issuedAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, jobOrder: true, sales: true, receivable: true },
    });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.invoice.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.invoice.delete({ where: { id } });
  }
}