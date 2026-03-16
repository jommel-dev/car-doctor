import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.tblvehicles.create({ data: data as never });
  }

  findAll() {
    return this.prisma.tblvehicles.findMany({
      include: { customer: true, history: true, jobOrders: true, milestones: true },
      orderBy: { id: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.tblvehicles.findUnique({
      where: { id },
      include: { customer: true, history: true, jobOrders: true, milestones: true },
    });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.tblvehicles.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.tblvehicles.delete({ where: { id } });
  }
}