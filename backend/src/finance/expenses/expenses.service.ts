import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.tblexpenses.create({ data: data as never });
  }

  findAll() {
    return this.prisma.tblexpenses.findMany({ orderBy: { created_at: 'desc' } });
  }

  findOne(id: number) {
    return this.prisma.tblexpenses.findUnique({ where: { id } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.tblexpenses.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.tblexpenses.delete({ where: { id } });
  }
}