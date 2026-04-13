import { Injectable } from '@nestjs/common';
import { Prisma, Salon, SalonStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class SalonsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.SalonCreateInput): Promise<Salon> {
    return this.prisma.salon.create({ data });
  }

  findBySlug(slug: string): Promise<Salon | null> {
    return this.prisma.salon.findUnique({ where: { slug } });
  }

  findById(id: string): Promise<Salon | null> {
    return this.prisma.salon.findUnique({ where: { id } });
  }

  listByOwner(ownerId: string) {
    return this.prisma.salon.findMany({ where: { ownerId } });
  }

  updateStatus(id: string, status: SalonStatus): Promise<Salon> {
    return this.prisma.salon.update({ where: { id }, data: { status } });
  }
}
