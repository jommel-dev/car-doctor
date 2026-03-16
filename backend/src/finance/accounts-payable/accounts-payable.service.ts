import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccountsPayableService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Record<string, unknown>) {
    return this.prisma.tblaccounts_payable.create({ data: data as never });
  }

  findAll() {
    return this.prisma.tblaccounts_payable.findMany({ include: { supplier: true, purchase: true } });
  }

  findOne(id: number) {
    return this.prisma.tblaccounts_payable.findUnique({ where: { id }, include: { supplier: true, purchase: true } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.tblaccounts_payable.update({ where: { id }, data: data as never });
  }

  remove(id: number) {
    return this.prisma.tblaccounts_payable.delete({ where: { id } });
  }
}