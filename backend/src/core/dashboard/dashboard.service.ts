import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private startOfDay(date: Date): Date {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  private startOfWeek(date: Date): Date {
    const value = this.startOfDay(date);
    const day = value.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    value.setDate(value.getDate() + diff);
    return value;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfYear(date: Date): Date {
    return new Date(date.getFullYear(), 0, 1);
  }

  private toNumber(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  async getOverview() {
    const now = new Date();
    const startOfToday = this.startOfDay(now);
    const startOfWeek = this.startOfWeek(now);
    const startOfMonth = this.startOfMonth(now);
    const startOfYear = this.startOfYear(now);
    const nextYear = new Date(now.getFullYear() + 1, 0, 1);

    const [
      todaySales,
      inProgressJobs,
      pendingJobs,
      inventoryRows,
      customerCount,
      salesThisYear,
      completedJobOrders,
      latestSale,
    ] = await Promise.all([
      this.prisma.tblsales.aggregate({
        _sum: { amount: true },
        where: { created_at: { gte: startOfToday } },
      }),
      this.prisma.tbljoborders.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.tbljoborders.count({ where: { status: 'PENDING' } }),
      this.prisma.tblinventory.findMany({
        include: {
          supplier: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ stockQty: 'asc' }, { partName: 'asc' }],
      }),
      this.prisma.tblcustomers.count(),
      this.prisma.tblsales.findMany({
        where: {
          created_at: {
            gte: startOfYear,
            lt: nextYear,
          },
        },
        select: {
          amount: true,
          created_at: true,
        },
      }),
      this.prisma.tbljoborders.findMany({
        where: {
          status: 'COMPLETED',
          completed_at: { not: null },
        },
        select: {
          id: true,
          vehicleId: true,
          completed_at: true,
          jobsDone: true,
          mechanicSignatoryName: true,
          technician: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          completed_at: 'desc',
        },
      }),
      this.prisma.tblsales.findFirst({
        orderBy: {
          created_at: 'desc',
        },
        include: {
          jobOrder: {
            include: {
              technician: {
                select: {
                  name: true,
                },
              },
              vehicle: {
                include: {
                  customer: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const monthlySales = Array.from({ length: 12 }, (_value, index) => ({
      month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(now.getFullYear(), index, 1)),
      total: 0,
    }));

    for (const sale of salesThisYear) {
      const saleDate = new Date(sale.created_at);
      if (Number.isNaN(saleDate.getTime())) {
        continue;
      }

      monthlySales[saleDate.getMonth()].total += this.toNumber(sale.amount);
    }

    const topMechanicsMap = new Map<string, { technicianName: string; completedJobs: number; lastCompletedAt: Date | null }>();
    const servicedDailyVehicles = new Set<string>();
    const servicedWeeklyVehicles = new Set<string>();
    const servicedMonthlyVehicles = new Set<string>();

    for (const jobOrder of completedJobOrders) {
      const completedAt = jobOrder.completed_at ? new Date(jobOrder.completed_at) : null;
      const technicianName = String(jobOrder.technician?.name ?? jobOrder.mechanicSignatoryName ?? 'Unassigned').trim() || 'Unassigned';
      const mechanicEntry = topMechanicsMap.get(technicianName) ?? {
        technicianName,
        completedJobs: 0,
        lastCompletedAt: null,
      };

      mechanicEntry.completedJobs += 1;
      if (completedAt && (!mechanicEntry.lastCompletedAt || completedAt > mechanicEntry.lastCompletedAt)) {
        mechanicEntry.lastCompletedAt = completedAt;
      }
      topMechanicsMap.set(technicianName, mechanicEntry);

      if (!completedAt) {
        continue;
      }

      const vehicleKey = String(jobOrder.vehicleId);
      if (completedAt >= startOfToday) {
        servicedDailyVehicles.add(vehicleKey);
      }
      if (completedAt >= startOfWeek) {
        servicedWeeklyVehicles.add(vehicleKey);
      }
      if (completedAt >= startOfMonth) {
        servicedMonthlyVehicles.add(vehicleKey);
      }
    }

    const inventoryItems = inventoryRows.map((item) => {
      const stockQty = this.toNumber(item.stockQty);
      const lowStockThreshold = this.toNumber(item.lowStockThreshold);
      const isLowStock = stockQty <= lowStockThreshold;
      const isOutOfStock = stockQty <= 0;

      return {
        id: item.id,
        partName: item.partName,
        supplierName: item.supplier?.name ?? null,
        stockQty,
        lowStockThreshold,
        isLowStock,
        isOutOfStock,
      };
    });

    const availableStockItems = inventoryItems.filter((item) => item.stockQty > 0).length;
    const lowStockItems = inventoryItems.filter((item) => item.isLowStock).length;
    const outOfStockItems = inventoryItems.filter((item) => item.isOutOfStock).length;
    const topMechanics = Array.from(topMechanicsMap.values())
      .sort((left, right) => {
        if (right.completedJobs !== left.completedJobs) {
          return right.completedJobs - left.completedJobs;
        }

        const leftTime = left.lastCompletedAt ? left.lastCompletedAt.getTime() : 0;
        const rightTime = right.lastCompletedAt ? right.lastCompletedAt.getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 5);

    const lastCompletedJob = latestSale?.jobOrder
      ? {
          saleId: latestSale.id,
          jobOrderId: latestSale.jobOrder.id,
          amount: latestSale.amount,
          completedAt: latestSale.jobOrder.completed_at,
          customerName: latestSale.jobOrder.vehicle?.customer?.name ?? null,
          vehicleLabel: [latestSale.jobOrder.vehicle?.make, latestSale.jobOrder.vehicle?.model]
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)
            .join(' '),
          plateNumber: latestSale.jobOrder.vehicle?.plateNumber ?? null,
          technicianName: latestSale.jobOrder.technician?.name ?? latestSale.jobOrder.mechanicSignatoryName ?? null,
          jobsDone: latestSale.jobOrder.jobsDone ?? null,
        }
      : null;

    return {
      dailySalesSummary: todaySales._sum.amount ?? 0,
      activeRepairJobs: inProgressJobs,
      pendingServiceRequests: pendingJobs,
      customerCount,
      vehicleServiced: {
        daily: servicedDailyVehicles.size,
        weekly: servicedWeeklyVehicles.size,
        monthly: servicedMonthlyVehicles.size,
      },
      availableStockItems,
      lowStockItems,
      outOfStockItems,
      inventoryItems,
      monthlySales,
      topMechanics,
      lastCompletedJob,
    };
  }
}