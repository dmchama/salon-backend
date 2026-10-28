import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OwnerSubscriptionStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  RegistrationPaymentsService,
  UploadedReceipt,
} from '../registration-payments/registration-payments.service';
import { UsersRepository } from '../users/repositories/users.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly registrationPayments: RegistrationPaymentsService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, receiptFile?: Express.Multer.File) {
    if (dto.role === Role.SUPER_ADMIN) {
      throw new DomainException('FORBIDDEN_ROLE', 'Cannot self-register as super admin', 403);
    }
    if (dto.role === Role.SALON_ADMIN) {
      return this.registerSalonAdminWithPlan(dto, receiptFile);
    }
    throw new DomainException('INVALID_ROLE', 'Invalid registration', 400);
  }

  /**
   * Creates SALON_ADMIN user + active OwnerSubscription (+ RegistrationPayment when a receipt
   * is attached) in one transaction. The receipt is uploaded first; if the DB write then fails
   * the upload is discarded (spec 002 AC7, AC8).
   */
  private async registerSalonAdminWithPlan(dto: RegisterDto, receiptFile?: Express.Multer.File) {
    this.logger.log('[register] START');
    if (!receiptFile && this.config.get<boolean>('registrationReceiptRequired')) {
      throw new DomainException('RECEIPT_REQUIRED', 'Please upload your payment receipt', 400);
    }
    // Cheap checks before uploading, so a duplicate email never leaves an orphan receipt.
    if (await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } })) {
      throw new DomainException('EMAIL_IN_USE', 'Email already registered', 409);
    }
    const activePlan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: dto.subscriptionPlanId!, active: true },
      select: { id: true },
    });
    if (!activePlan) {
      throw new DomainException('PLAN_NOT_FOUND', 'Subscription plan not found', 404);
    }

    const receipt: UploadedReceipt | null = receiptFile
      ? await this.registrationPayments.uploadReceipt(receiptFile)
      : null;

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
      if (receipt) {
        await this.registrationPayments.createForRegistration(tx, { ownerId: created.id, plan, receipt });
      }
      return created;
    }).catch(async (err) => {
      if (receipt) await this.registrationPayments.discardReceipt(receipt);
      this.logger.error(`[register] FAIL ${(err as Error)?.message ?? err}`);
      throw err;
    });
    this.logger.log(`[register] OK user=${user.id} receipt=${receipt ? 'yes' : 'no'}`);
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
