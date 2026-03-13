import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.vehicle.create({ data: data as never });
  }

  findAll() {
    return this.prisma.vehicle.findMany({
      include: { customer: true, history: true, jobOrders: true },
      orderBy: { id: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.vehicle.findUnique({
      where: { id },
      include: { customer: true, history: true, jobOrders: true },
    });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.vehicle.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.vehicle.delete({ where: { id } });
  }
}