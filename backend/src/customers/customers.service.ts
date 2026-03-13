import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.customer.create({ data: data as never });
  }

  findAll() {
    return this.prisma.customer.findMany({
      include: { vehicles: true, invoices: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.customer.findUnique({ where: { id }, include: { vehicles: true, invoices: true } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.customer.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.customer.delete({ where: { id } });
  }
}