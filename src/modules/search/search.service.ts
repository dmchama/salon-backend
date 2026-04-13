import { Injectable } from '@nestjs/common';
import { SalonStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  searchSalons(q?: string, city?: string) {
    return this.prisma.salon.findMany({
      where: {
        status: SalonStatus.PUBLISHED,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { description: { contains: q } },
              ],
            }
          : {}),
        ...(city ? { city: { contains: city } } : {}),
      },
      take: 50,
      orderBy: { name: 'asc' },
    });
  }
}
