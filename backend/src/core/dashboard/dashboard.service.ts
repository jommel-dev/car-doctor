import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      todaySales,
      activeRepairJobs,
      pendingServiceRequests,
      lowStockItems,
      receivables,
      todayExpenses,
      recentTransactions,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      this.prisma.jobOrder.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      this.prisma.jobOrder.count({ where: { status: 'PENDING' } }),
      this.prisma.$queryRaw`
        SELECT *
        FROM inventory
        WHERE stock_qty <= low_stock_threshold
        ORDER BY stock_qty ASC
        LIMIT 10
      `,
      this.prisma.accountReceivable.aggregate({ _sum: { balance: true } }),
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      this.prisma.sale.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    return {
      dailySalesSummary: todaySales._sum.amount ?? 0,
      activeRepairJobs,
      pendingServiceRequests,
      inventoryAlerts: lowStockItems,
      accountsReceivableSummary: receivables._sum.balance ?? 0,
      expenseOverview: todayExpenses._sum.amount ?? 0,
      recentTransactions,
    };
  }
}