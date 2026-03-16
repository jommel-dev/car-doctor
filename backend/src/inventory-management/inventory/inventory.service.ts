import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private toBigIntOrNull(value: unknown): bigint | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const raw = String(value).trim();
    if (!/^\d+$/.test(raw)) {
      return null;
    }

    return BigInt(raw);
  }

  private toOptionalBigInt(value: unknown): bigint | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    const raw = String(value).trim();
    if (!raw) {
      return null;
    }

    if (!/^\d+$/.test(raw)) {
      return null;
    }

    return BigInt(raw);
  }

  private toOptionalDecimalString(value: unknown): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return numeric.toFixed(2);
  }

  private normalizeInventoryData(data: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...data };

    if (Object.prototype.hasOwnProperty.call(data, 'supplierId')) {
      normalized.supplierId = this.toOptionalBigInt(data.supplierId);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'costPrice')) {
      normalized.costPrice = this.toOptionalDecimalString(data.costPrice);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'srpPrice')) {
      normalized.srpPrice = this.toOptionalDecimalString(data.srpPrice);
    }

    return normalized;
  }

  create(data: Record<string, unknown>) {
    return this.prisma.tblinventory.create({
      data: this.normalizeInventoryData(data) as never,
    });
  }

  async findAll(filters?: {
    search?: string;
    supplierId?: string;
    lowStock?: string;
  }) {
    const search = String(filters?.search ?? '').trim();
    const supplierId = this.toBigIntOrNull(filters?.supplierId);
    const lowStockEnabled = ['1', 'true', 'yes', 'on'].includes(
      String(filters?.lowStock ?? '').trim().toLowerCase(),
    );

    const rows = await this.prisma.tblinventory.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { partName: { contains: search, mode: 'insensitive' } },
                { supplier: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: { supplier: true },
      orderBy: { id: 'desc' },
    });

    if (!lowStockEnabled) {
      return rows;
    }

    return rows.filter((item) => {
      const stockQty = Number(item.stockQty ?? 0);
      const threshold = Number(item.lowStockThreshold ?? 0);
      return stockQty <= threshold;
    });
  }

  findOne(id: number) {
    return this.prisma.tblinventory.findUnique({ where: { id }, include: { supplier: true } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.tblinventory.update({
      where: { id },
      data: this.normalizeInventoryData(data) as never,
    });
  }

  remove(id: number) {
    return this.prisma.tblinventory.delete({ where: { id } });
  }

  async lowStockAlerts() {
    const items = await this.prisma.$queryRaw`
      SELECT *
      FROM tblinventory
      WHERE stock_qty <= low_stock_threshold
      ORDER BY stock_qty ASC
    `;

    return items;
  }
}