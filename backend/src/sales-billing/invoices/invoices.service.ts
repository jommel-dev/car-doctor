import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.tblinvoices.create({ data: data as never });
  }

  findAll() {
    return this.prisma.tblinvoices.findMany({
      include: { customer: true, jobOrder: true, sales: true, receivable: true },
      orderBy: { issued_at: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.tblinvoices.findUnique({
      where: { id },
      include: { customer: true, jobOrder: true, sales: true, receivable: true },
    });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.tblinvoices.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.tblinvoices.delete({ where: { id } });
  }
}