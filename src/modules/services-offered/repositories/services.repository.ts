import { Injectable } from '@nestjs/common';
import { Prisma, Service } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class ServicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ServiceCreateInput): Promise<Service> {
    return this.prisma.service.create({ data });
  }

  listForSalon(salonId: string) {
    return this.prisma.service.findMany({
      where: { salonId, active: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  listAllForSalon(salonId: string) {
    return this.prisma.service.findMany({
      where: { salonId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  update(id: string, data: Prisma.ServiceUpdateInput): Promise<Service> {
    return this.prisma.service.update({ where: { id }, data });
  }
}
