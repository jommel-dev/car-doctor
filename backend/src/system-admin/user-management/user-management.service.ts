import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserManagementService {
  constructor(private readonly prisma: PrismaService) {}

  createUser(data: Record<string, unknown>) {
    return this.prisma.user.create({ data: data as never });
  }

  findUsers() {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  }

  updateUser(id: number, data: Record<string, unknown>) {
    return this.prisma.user.update({ where: { id }, data: data as never });
  }

  removeUser(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }

  createTechnician(data: Record<string, unknown>) {
    return this.prisma.technician.create({ data: data as never });
  }

  findTechnicians() {
    return this.prisma.technician.findMany({ orderBy: { id: 'desc' } });
  }
}