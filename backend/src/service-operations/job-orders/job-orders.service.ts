import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JobOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.jobOrder.create({ data: data as never });
  }

  findAll() {
    return this.prisma.jobOrder.findMany({
      include: { vehicle: true, technician: true, services: true, invoices: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.jobOrder.findUnique({
      where: { id },
      include: { vehicle: true, technician: true, services: true, invoices: true },
    });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.jobOrder.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.jobOrder.delete({ where: { id } });
  }
}