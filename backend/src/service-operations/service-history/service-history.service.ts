import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ServiceHistoryService {
  constructor(private readonly prisma: PrismaService) {}

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

  private toOptionalDate(value: unknown): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

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

  private normalizeServiceHistoryData(data: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...data };

    if (Object.prototype.hasOwnProperty.call(data, 'vehicleId')) {
      normalized.vehicleId = this.toOptionalBigInt(data.vehicleId);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'jobOrderId')) {
      normalized.jobOrderId = this.toOptionalBigInt(data.jobOrderId);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'serviceDate')) {
      normalized.serviceDate = this.toOptionalDate(data.serviceDate);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'partsReplaced')) {
      normalized.partsReplaced = this.toOptionalString(data.partsReplaced);
    }

    if (Object.prototype.hasOwnProperty.call(data, 'notes')) {
      normalized.notes = this.toOptionalString(data.notes);
    }

    return normalized;
  }

  create(data: Record<string, unknown>) {
    return this.prisma.tblservice_history.create({
      data: this.normalizeServiceHistoryData(data) as never,
    });
  }

  findAll() {
    return this.prisma.tblservice_history.findMany({
      include: { vehicle: true, jobOrder: true },
      orderBy: { serviceDate: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.tblservice_history.findUnique({ where: { id }, include: { vehicle: true, jobOrder: true } });
  }

  update(id: number, data: Record<string, unknown>) {
    return this.prisma.tblservice_history.update({
      where: { id },
      data: this.normalizeServiceHistoryData(data) as never,
    });
  }

  remove(id: number) {
    return this.prisma.tblservice_history.delete({ where: { id } });
  }
}