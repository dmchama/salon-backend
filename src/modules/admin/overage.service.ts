import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';

@Injectable()
export class OverageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  // ── Overage Price ──────────────────────────────────────────────────────────

  async getOveragePrice(): Promise<{ priceCents: number }> {
    const row = await this.prisma.overagePricing.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    return { priceCents: row?.priceCents ?? 0 };
  }

  async setOveragePrice(priceCents: number): Promise<{ priceCents: number }> {
    const row = await this.prisma.overagePricing.create({ data: { priceCents } });
    return { priceCents: row.priceCents };
  }

  // ── Overage Invoices ───────────────────────────────────────────────────────

  async generateInvoices(year: number, month: number) {
    const { priceCents: overagePriceCents } = await this.getOveragePrice();

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 1);

    const owners = await this.prisma.user.findMany({
      where: { role: 'SALON_ADMIN' },
      include: {
        ownedSalons: { select: { id: true } },
        ownerSubscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { expiresAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    });

    const results: { ownerId: string; overageCount: number; invoiceId: string | null }[] = [];

    for (const owner of owners) {
      const sub = owner.ownerSubscriptions[0];
      if (!sub) continue;

      const limits = (sub.plan.limits as { monthlyBookingLimit?: number } | null);
      const bookingLimit = limits?.monthlyBookingLimit ?? 200;

      const salonIds = owner.ownedSalons.map((s) => s.id);
      if (salonIds.length === 0) continue;

      const totalBookings = await this.prisma.booking.count({
        where: { salonId: { in: salonIds }, createdAt: { gte: monthStart, lt: monthEnd } },
      });

      const overageCount = Math.max(0, totalBookings - bookingLimit);
      if (overageCount === 0) continue;

      const totalCents = overageCount * overagePriceCents;

      const invoice = await this.prisma.overageInvoice.upsert({
        where: { ownerId_year_month: { ownerId: owner.id, year, month } },
        create: {
          ownerId: owner.id, year, month,
          bookingLimit, totalBookings, overageCount,
          overagePriceCents, totalCents,
          status: 'DRAFT',
        },
        update: {
          bookingLimit, totalBookings, overageCount,
          overagePriceCents, totalCents,
          status: 'DRAFT',
        },
      });

      results.push({ ownerId: owner.id, overageCount, invoiceId: invoice.id });
    }

    return { generated: results.length, invoices: results };
  }

  async listInvoices(status?: string) {
    return this.prisma.overageInvoice.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async sendInvoice(id: string) {
    const invoice = await this.prisma.overageInvoice.findUnique({
      where: { id },
      include: { owner: true },
    });
    if (!invoice) throw new DomainException('NOT_FOUND', 'Invoice not found', 404);
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new DomainException('INVALID_STATUS', 'Cannot send a paid or cancelled invoice', 400);
    }

    const ownerName = [invoice.owner.firstName, invoice.owner.lastName].filter(Boolean).join(' ') || invoice.owner.email;

    await this.dispatcher.dispatchOverageInvoice(invoice.owner.email, ownerName, {
      year: invoice.year,
      month: invoice.month,
      bookingLimit: invoice.bookingLimit,
      totalBookings: invoice.totalBookings,
      overageCount: invoice.overageCount,
      overagePriceCents: invoice.overagePriceCents,
      totalCents: invoice.totalCents,
    });

    return this.prisma.overageInvoice.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    });
  }

  async markPaid(id: string) {
    const invoice = await this.prisma.overageInvoice.findUnique({ where: { id } });
    if (!invoice) throw new DomainException('NOT_FOUND', 'Invoice not found', 404);
    return this.prisma.overageInvoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  async cancelInvoice(id: string) {
    const invoice = await this.prisma.overageInvoice.findUnique({ where: { id } });
    if (!invoice) throw new DomainException('NOT_FOUND', 'Invoice not found', 404);
    return this.prisma.overageInvoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
