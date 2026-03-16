import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.tblsuppliers.create({ data: data as never });
  }

  findAll() {
    return this.prisma.tblsuppliers.findMany({ include: { inventory: true, payables: true, purchases: true } });
  }

  findOne(id: number) {
    return this.prisma.tblsuppliers.findUnique({
      where: { id },
      include: { inventory: true, payables: true, purchases: true },
    });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.tblsuppliers.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.tblsuppliers.delete({ where: { id } });
  }
}