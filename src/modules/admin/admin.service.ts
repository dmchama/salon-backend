import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(role: Role) {
    if (role !== Role.ADMIN) {
      throw new DomainException('FORBIDDEN', 'Admin only', 403);
    }
    const [users, salons, bookings, plans] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.salon.count(),
      this.prisma.booking.count(),
      this.prisma.subscriptionPlan.count(),
    ]);
    return { users, salons, bookings, subscriptionPlans: plans };
  }
}
