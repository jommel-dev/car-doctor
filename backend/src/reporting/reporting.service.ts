import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [sales, inventory, services, expenses, receivables, payables, technicians] = await Promise.all([
      this.prisma.sale.aggregate({ _sum: { amount: true }, _count: true }),
      this.prisma.inventory.findMany({ orderBy: { stockQty: 'asc' } }),
      this.prisma.serviceHistory.count(),
      this.prisma.expense.aggregate({ _sum: { amount: true }, _count: true }),
      this.prisma.accountReceivable.findMany({ include: { customer: true, invoice: true } }),
      this.prisma.accountPayable.findMany({ include: { supplier: true, purchase: true } }),
      this.prisma.technician.findMany(),
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