import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SalonOwnersService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(ownerId: string, role: Role) {
    if (role !== Role.OWNER) {
      throw new DomainException('FORBIDDEN', 'Owner only', 403);
    }
    const salons = await this.prisma.salon.findMany({
      where: { ownerId },
      include: {
        _count: { select: { bookings: true, services: true } },
      },
    });
    const subscription = await this.prisma.ownerSubscription.findFirst({
      where: { ownerId, status: 'ACTIVE' },
      orderBy: { expiresAt: 'desc' },
      include: { plan: true },
    });
    return { salons, subscription };
  }
}
