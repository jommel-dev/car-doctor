import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly salesInclude = {
    jobOrder: {
      include: {
        vehicle: {
          include: {
            customer: true,
          },
        },
        technician: true,
        supplies: true,
        invoices: true,
        services: true,
      },
    },
    inventory: true,
    invoice: true,
  } as const;

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

  private normalizeSalesData(data: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...data };

    if (Object.prototype.hasOwnProperty.call(data, 'jobOrderId')) {
      normalized.jobOrderId = this.toOptionalBigInt(data.jobOrderId);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'inventoryId')) {
      normalized.inventoryId = this.toOptionalBigInt(data.inventoryId);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'invoiceId')) {
      normalized.invoiceId = this.toOptionalBigInt(data.invoiceId);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'amount')) {
      normalized.amount = this.toOptionalDecimalString(data.amount);
    }

    return normalized;
  }

  create(data: Record<string, unknown>) {
    return this.prisma.tblsales.create({
      data: this.normalizeSalesData(data) as never,
    });
  }

  findAll() {
    return this.prisma.tblsales.findMany({
      include: this.salesInclude,
      orderBy: { created_at: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.tblsales.findUnique({ where: { id }, include: this.salesInclude });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.tblsales.update({
      where: { id },
      data: this.normalizeSalesData(data) as never,
    });
  }

  remove(id: number) {
    return this.prisma.tblsales.delete({ where: { id } });
  }
}