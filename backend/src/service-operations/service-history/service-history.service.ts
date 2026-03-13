import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ServiceHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.serviceHistory.create({ data: data as never });
  }

  findAll() {
    return this.prisma.serviceHistory.findMany({
      include: { vehicle: true, jobOrder: true },
      orderBy: { serviceDate: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.serviceHistory.findUnique({ where: { id }, include: { vehicle: true, jobOrder: true } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.serviceHistory.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.serviceHistory.delete({ where: { id } });
  }
}