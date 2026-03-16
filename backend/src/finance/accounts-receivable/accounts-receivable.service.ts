import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccountsReceivableService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.tblaccounts_receivable.create({ data: data as never });
  }

  findAll() {
    return this.prisma.tblaccounts_receivable.findMany({ include: { customer: true, invoice: true } });
  }

  findOne(id: number) {
    return this.prisma.tblaccounts_receivable.findUnique({ where: { id }, include: { customer: true, invoice: true } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.tblaccounts_receivable.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.tblaccounts_receivable.delete({ where: { id } });
  }
}