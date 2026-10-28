import { Injectable, Logger } from '@nestjs/common';
import {
  OwnerSubscriptionStatus,
  Prisma,
  RegistrationPayment,
  RegistrationPaymentStatus,
  SubscriptionPlan,
} from '@prisma/client';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationProducerService } from '../notifications/notification-producer.service';
import { assertValidReceiptFile } from './domain/receipt-file.policy';
import {
  assertCanReupload,
  assertCanReview,
  subscriptionPeriodFrom,
} from './domain/registration-payment.policy';

const RECEIPTS_FOLDER = 'registration-receipts';

export type UploadedReceipt = { publicId: string; format: string };

type PaymentWithPlan = RegistrationPayment & {
  plan: Pick<SubscriptionPlan, 'name'>;
};

@Injectable()
export class RegistrationPaymentsService {
  private readonly logger = new Logger(RegistrationPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly notifications: NotificationProducerService,
  ) {}

  // ── Receipt storage ──────────────────────────────────────────────────────

  /** Validate and upload a receipt as a private Cloudinary asset (BR3). Nothing is written to the DB. */
  async uploadReceipt(file: Express.Multer.File): Promise<UploadedReceipt> {
    assertValidReceiptFile(file.mimetype, file.size);
    try {
      return await this.cloudinary.uploadPrivate(file.buffer, RECEIPTS_FOLDER);
    } catch (err) {
      this.logger.error(
        `[uploadReceipt] FAIL ${(err as Error)?.message ?? err}`,
      );
      throw new DomainException(
        'RECEIPT_UPLOAD_FAILED',
        'Could not upload the receipt. Please try again.',
        502,
      );
    }
  }

  /** Best-effort cleanup when the DB write after an upload fails. */
  discardReceipt(receipt: UploadedReceipt): Promise<void> {
    return this.cloudinary.deleteAuthenticated(receipt.publicId);
  }

  /** Record the registration payment inside the registration transaction (BR2: amount = plan price now). */
  createForRegistration(
    tx: Prisma.TransactionClient,
    data: { ownerId: string; plan: SubscriptionPlan; receipt: UploadedReceipt },
  ): Promise<RegistrationPayment> {
    return tx.registrationPayment.create({
      data: {
        ownerId: data.ownerId,
        planId: data.plan.id,
        amountCents: data.plan.priceCents,
        currency: data.plan.currency,
        receiptPublicId: data.receipt.publicId,
        receiptFormat: data.receipt.format,
      },
    });
  }

  // ── Owner ────────────────────────────────────────────────────────────────

  async getMine(ownerId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { accountStatus: true },
    });
    if (!owner)
      throw new DomainException('NOT_FOUND', 'Account not found', 404);
    const latest = await this.latestFor(ownerId);
    return {
      accountStatus: owner.accountStatus,
      payment: latest ? this.toView(latest) : null,
    };
  }

  async reupload(ownerId: string, file: Express.Multer.File | undefined) {
    this.logger.log(`[reupload] START owner=${ownerId}`);
    if (!file) {
      throw new DomainException(
        'RECEIPT_REQUIRED',
        'Please attach your payment receipt',
        400,
      );
    }
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { accountStatus: true },
    });
    if (!owner)
      throw new DomainException('NOT_FOUND', 'Account not found', 404);
    const latest = await this.latestFor(ownerId);
    assertCanReupload(owner.accountStatus, latest?.status ?? null);

    const sub = await this.prisma.ownerSubscription.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (!sub)
      throw new DomainException(
        'NO_SUBSCRIPTION',
        'No subscription plan found for this account',
        404,
      );

    const receipt = await this.uploadReceipt(file);
    try {
      await this.createForRegistration(this.prisma, {
        ownerId,
        plan: sub.plan,
        receipt,
      });
    } catch (err) {
      await this.discardReceipt(receipt);
      this.logger.error(`[reupload] FAIL owner=${ownerId}`);
      throw err;
    }
    this.logger.log(`[reupload] OK owner=${ownerId}`);
    return this.getMine(ownerId);
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  async getForOwner(ownerId: string) {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner || owner.role !== 'SALON_ADMIN') {
      throw new DomainException('NOT_FOUND', 'Salon owner not found', 404);
    }
    const payments = await this.prisma.registrationPayment.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true } } },
    });
    const [latest, ...older] = payments;
    return {
      owner: {
        id: owner.id,
        displayName:
          [owner.firstName, owner.lastName].filter(Boolean).join(' ') ||
          owner.email,
        email: owner.email,
        accountStatus: owner.accountStatus,
      },
      payment: latest
        ? { ...this.toView(latest), reviewedAt: latest.reviewedAt }
        : null,
      history: older.map((p) => ({
        id: p.id,
        status: p.status,
        rejectionReason: p.rejectionReason,
        createdAt: p.createdAt,
        reviewedAt: p.reviewedAt,
      })),
    };
  }

  /** Approve: payment APPROVED, account ACTIVE, subscription restarted from now (BR5, BR10). */
  async approve(paymentId: string, adminId: string) {
    this.logger.log(`[approve] START payment=${paymentId}`);
    const payment = await this.findOrThrow(paymentId);
    assertCanReview(payment.status);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.registrationPayment.updateMany({
        where: { id: paymentId, status: RegistrationPaymentStatus.PENDING },
        data: {
          status: RegistrationPaymentStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: now,
        },
      });
      if (updated.count === 0)
        assertCanReview(RegistrationPaymentStatus.APPROVED); // raced with another review

      await tx.user.update({
        where: { id: payment.ownerId },
        data: { accountStatus: 'ACTIVE' },
      });

      const sub = await tx.ownerSubscription.findFirst({
        where: {
          ownerId: payment.ownerId,
          status: OwnerSubscriptionStatus.ACTIVE,
        },
        orderBy: { createdAt: 'desc' },
        include: { plan: { select: { intervalMonths: true } } },
      });
      if (sub) {
        const period = subscriptionPeriodFrom(now, sub.plan.intervalMonths);
        await tx.ownerSubscription.update({
          where: { id: sub.id },
          data: period,
        });
      }
    });

    this.notify('approved', paymentId);
    this.logger.log(
      `[approve] OK payment=${paymentId} owner=${payment.ownerId}`,
    );
    return { message: 'Payment approved', ownerId: payment.ownerId };
  }

  /** Reject with a reason; the account stays PENDING so the owner can re-upload (AC18). */
  async reject(paymentId: string, adminId: string, reason: string) {
    this.logger.log(`[reject] START payment=${paymentId}`);
    const payment = await this.findOrThrow(paymentId);
    assertCanReview(payment.status);

    const updated = await this.prisma.registrationPayment.updateMany({
      where: { id: paymentId, status: RegistrationPaymentStatus.PENDING },
      data: {
        status: RegistrationPaymentStatus.REJECTED,
        rejectionReason: reason.trim(),
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
    if (updated.count === 0)
      assertCanReview(RegistrationPaymentStatus.REJECTED);

    this.notify('rejected', paymentId);
    this.logger.log(
      `[reject] OK payment=${paymentId} owner=${payment.ownerId}`,
    );
    return { message: 'Payment rejected', ownerId: payment.ownerId };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private latestFor(ownerId: string): Promise<PaymentWithPlan | null> {
    return this.prisma.registrationPayment.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true } } },
    });
  }

  private async findOrThrow(paymentId: string): Promise<RegistrationPayment> {
    const payment = await this.prisma.registrationPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment)
      throw new DomainException('PAYMENT_NOT_FOUND', 'Payment not found', 404);
    return payment;
  }

  /** Fire-and-forget: a failed enqueue never fails the admin's action (BR12). */
  private notify(outcome: 'approved' | 'rejected', paymentId: string): void {
    this.notifications
      .enqueueRegistrationPaymentReviewed(outcome, {
        registrationPaymentId: paymentId,
      })
      .catch((err) =>
        this.logger.warn(
          `[notify] FAIL ${outcome} payment=${paymentId}: ${(err as Error)?.message ?? err}`,
        ),
      );
  }

  private toView(p: PaymentWithPlan) {
    return {
      id: p.id,
      status: p.status,
      amountCents: p.amountCents,
      currency: p.currency,
      planName: p.plan.name,
      rejectionReason: p.rejectionReason,
      createdAt: p.createdAt,
      receiptFormat: p.receiptFormat,
      receiptUrl: this.cloudinary.signedReceiptUrl(
        p.receiptPublicId,
        p.receiptFormat,
      ),
    };
  }
}
