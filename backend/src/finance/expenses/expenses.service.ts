import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.expense.create({ data: data as never });
  }

  findAll() {
    return this.prisma.expense.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findOne(id: number) {
    return this.prisma.expense.findUnique({ where: { id } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.expense.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.expense.delete({ where: { id } });
  }
}