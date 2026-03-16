import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCustomerData(data: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...data };

    if (!normalized['contact'] && normalized['contactInfo']) {
      normalized['contact'] = normalized['contactInfo'];
    }

    delete normalized['contactInfo'];
    return normalized;
  }

  create(data: Record<string, unknown>) {
    const normalizedData = this.normalizeCustomerData(data);
    return this.prisma.tblcustomers.create({ data: normalizedData as never });
  }

  findAll() {
    return this.prisma.tblcustomers.findMany({
      include: { vehicles: true, invoices: true },
      orderBy: { created_at: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.tblcustomers.findUnique({ where: { id }, include: { vehicles: true, invoices: true } });
  }

  update(id: number, data: Record<string, unknown>) {
    const normalizedData = this.normalizeCustomerData(data);
    return this.prisma.tblcustomers.update({ where: { id }, data: normalizedData as never });
  }

  remove(id: number) {
    return this.prisma.tblcustomers.delete({ where: { id } });
  }
}