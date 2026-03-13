import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccountsReceivableService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.accountReceivable.create({ data: data as never });
  }

  findAll() {
    return this.prisma.accountReceivable.findMany({ include: { customer: true, invoice: true } });
  }

  findOne(id: number) {
    return this.prisma.accountReceivable.findUnique({ where: { id }, include: { customer: true, invoice: true } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.accountReceivable.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.accountReceivable.delete({ where: { id } });
  }
}