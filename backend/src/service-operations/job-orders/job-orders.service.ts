import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JobOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly jobOrderInclude = {
    vehicle: {
      include: {
        customer: true,
      },
    },
    technician: true,
    services: true,
    invoices: true,
    supplies: true,
  } as const;

  private toOptionalString(value: unknown): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const raw = String(value).trim();
    return raw ? raw : null;
  }

  private toOptionalDate(value: unknown): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toOptionalJson(value: unknown): unknown {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) {
        return null;
      }

      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }

    return value;
  }

  private toOptionalBigInt(value: unknown): bigint | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
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

    if (value === null) {
      return null;
    }

    const raw = String(value).trim();
    if (!raw) {
      return null;
    }

    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return numeric.toFixed(2);
  }

  private normalizeSupplyType(value: unknown): 'inventory' | 'customer_provided' | 'external_expense' {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'customer_provided') {
      return 'customer_provided';
    }
    if (normalized === 'external_expense') {
      return 'external_expense';
    }
    return 'inventory';
  }

  private normalizeSupplies(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        const supply = (entry ?? {}) as Record<string, unknown>;
        const supplyType = this.normalizeSupplyType(supply['supplyType']);
        const description = String(supply['description'] ?? '').trim();
        const quantityRaw = Number(supply['quantity'] ?? 0);
        const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? Math.round(quantityRaw) : 1;

        const normalizedSupply: Record<string, unknown> = {
          supplyType,
          description: description || (supplyType === 'inventory' ? 'Inventory item' : 'Supply item'),
          quantity,
          inventoryId: supplyType === 'inventory' ? this.toOptionalBigInt(supply['inventoryId']) : undefined,
          costPrice: this.toOptionalDecimalString(supply['costPrice']),
          billingPrice: this.toOptionalDecimalString(supply['billingPrice']),
        };

        return normalizedSupply;
      })
      .filter((supply) => Number(supply['quantity'] ?? 0) > 0);
  }

  private normalizeJobOrderUpdateData(data: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...data };

    if (Object.prototype.hasOwnProperty.call(data, 'technicianId')) {
      normalized.technicianId = this.toOptionalBigInt(data.technicianId);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'billingPrice')) {
      normalized.billingPrice = this.toOptionalDecimalString(data.billingPrice);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'jobsDone')) {
      normalized.jobsDone = this.toOptionalString(data.jobsDone);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'serviceRemarks')) {
      normalized.serviceRemarks = this.toOptionalString(data.serviceRemarks);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'mechanicSignatoryName')) {
      normalized.mechanicSignatoryName = this.toOptionalString(data.mechanicSignatoryName);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'mechanicSignatureData')) {
      normalized.mechanicSignatureData = this.toOptionalString(data.mechanicSignatureData);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'customerApprovedBy')) {
      normalized.customerApprovedBy = this.toOptionalString(data.customerApprovedBy);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'customerSignatureData')) {
      normalized.customerSignatureData = this.toOptionalString(data.customerSignatureData);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'customerReview')) {
      normalized.customerReview = this.toOptionalString(data.customerReview);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'completedAt')) {
      normalized.completed_at = this.toOptionalDate(data.completedAt);
      delete normalized.completedAt;
    }

    if (Object.prototype.hasOwnProperty.call(data, 'customerApprovedAt')) {
      normalized.customerApprovedAt = this.toOptionalDate(data.customerApprovedAt);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'mechanicSignedAt')) {
      normalized.mechanicSignedAt = this.toOptionalDate(data.mechanicSignedAt);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'forPaymentAt')) {
      normalized.forPaymentAt = this.toOptionalDate(data.forPaymentAt);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'customerApprovalSummary')) {
      normalized.customerApprovalSummary = this.toOptionalJson(data.customerApprovalSummary);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'paymentDetails')) {
      normalized.paymentDetails = this.toOptionalJson(data.paymentDetails);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'status')) {
      const status = String(data.status ?? '').trim().toUpperCase();
      normalized.status = status || 'PENDING';
    }

    return normalized;
  }

  create(data: Record<string, unknown>) {
    const { supplies, ...jobOrderData } = data;
    return this.prisma.tbljoborders.create({
      data: {
        ...jobOrderData,
        supplies: supplies ? {
          create: supplies as never
        } : undefined
      } as never,
      include: this.jobOrderInclude,
    });
  }

  findAll() {
    return this.prisma.tbljoborders.findMany({
      include: this.jobOrderInclude,
      orderBy: { created_at: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.tbljoborders.findUnique({
      where: { id },
      include: this.jobOrderInclude,
    });
  }

  update(id: number, data: Record<string, unknown>) {
    const { supplies, ...jobOrderData } = this.normalizeJobOrderUpdateData(data);
    const hasSupplies = Array.isArray(supplies);
    const normalizedSupplies = hasSupplies ? this.normalizeSupplies(supplies) : undefined;

    return this.prisma.tbljoborders.update({
      where: { id },
      data: {
        ...jobOrderData,
        supplies: hasSupplies
          ? {
              deleteMany: {},
              create: normalizedSupplies as never,
            }
          : undefined,
      } as never,
      include: this.jobOrderInclude,
    });
  }

  remove(id: number) {
    return this.prisma.tbljoborders.delete({ where: { id } });
  }
}