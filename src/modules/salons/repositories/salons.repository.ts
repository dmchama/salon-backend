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

  findPublishedWithDetails(slug: string) {
    return this.prisma.salon.findUnique({
      where: { slug },
      include: {
        services: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        technicians: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        gallery: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
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

  update(id: string, data: Prisma.SalonUpdateInput): Promise<Salon> {
    return this.prisma.salon.update({ where: { id }, data });
  }
}
