import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OwnerSubscriptionStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UsersRepository } from '../users/repositories/users.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.role === Role.SUPER_ADMIN) {
      throw new DomainException('FORBIDDEN_ROLE', 'Cannot self-register as super admin', 403);
    }
    if (dto.role === Role.SALON_ADMIN) {
      return this.registerSalonAdminWithPlan(dto);
    }
    throw new DomainException('INVALID_ROLE', 'Invalid registration', 400);
  }

  /** Creates SALON_ADMIN user + active OwnerSubscription in one transaction. */
  private async registerSalonAdminWithPlan(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: dto.email } });
      if (existing) {
        throw new DomainException('EMAIL_IN_USE', 'Email already registered', 409);
      }
      const plan = await tx.subscriptionPlan.findFirst({
        where: { id: dto.subscriptionPlanId!, active: true },
      });
      if (!plan) {
        throw new DomainException('PLAN_NOT_FOUND', 'Subscription plan not found', 404);
      }
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: Role.SALON_ADMIN,
          accountStatus: 'PENDING',
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
      const startsAt = new Date();
      const expiresAt = new Date(startsAt);
      expiresAt.setMonth(expiresAt.getMonth() + plan.intervalMonths);
      await tx.ownerSubscription.create({
        data: {
          ownerId: created.id,
          planId: plan.id,
          startsAt,
          expiresAt,
          status: OwnerSubscriptionStatus.ACTIVE,
        },
      });
      return created;
    });
    const token = await this.signToken(user.id, user.email, user.role);
    const { passwordHash: _, ...safe } = user;
    return { user: safe, accessToken: token };
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.accountStatus === 'SUSPENDED') {
      throw new DomainException('ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact support.', 403);
    }
    const token = await this.signToken(user.id, user.email, user.role);
    const { passwordHash: _, ...safe } = user;
    return { user: safe, accessToken: token };
  }

  private signToken(sub: string, email: string, role: Role): Promise<string> {
    return this.jwtService.signAsync({ sub, email, role });
  }
}
