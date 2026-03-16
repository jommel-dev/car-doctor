import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [sales, inventory, services, expenses, receivables, payables, technicians] = await Promise.all([
      this.prisma.tblsales.aggregate({ _sum: { amount: true }, _count: true }),
      this.prisma.tblinventory.findMany({ orderBy: { stockQty: 'asc' } }),
      this.prisma.tblservice_history.count(),
      this.prisma.tblexpenses.aggregate({ _sum: { amount: true }, _count: true }),
      this.prisma.tblaccounts_receivable.findMany({ include: { customer: true, invoice: true } }),
      this.prisma.tblaccounts_payable.findMany({ include: { supplier: true, purchase: true } }),
      this.prisma.tbltechnicians.findMany(),
    ]);

    return {
      sales,
      inventory,
      serviceCount: services,
      expenses,
      receivables,
      payables,
      technicianPerformance: technicians,
    };
  }
}