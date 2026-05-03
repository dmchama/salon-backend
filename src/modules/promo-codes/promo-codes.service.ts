import { Injectable } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  private randomCode(): string {
    return Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  }

  async create(data: {
    salonId: string;
    campaignName?: string;
    recipientCount?: number;
    discountPct: number;
    discountScope: string;
    serviceIds: string[];
    validFrom?: string;
    validTo?: string;
  }) {
    let code = this.randomCode();
    for (let i = 0; i < 4; i++) {
      const existing = await this.prisma.promoCode.findUnique({ where: { code } });
      if (!existing) break;
      code = this.randomCode();
    }

    const now = new Date();
    // Treat validFrom as "starts now" when the date is today or in the past
    const rawValidFrom = data.validFrom ? new Date(data.validFrom) : undefined;
    const effectiveValidFrom = rawValidFrom && rawValidFrom > now ? rawValidFrom : undefined;
    const rawValidTo = data.validTo ? new Date(data.validTo) : undefined;

    return this.prisma.promoCode.create({
      data: {
        salon: { connect: { id: data.salonId } },
        code,
        campaignName: data.campaignName,
        recipientCount: data.recipientCount ?? 0,
        discountPct: data.discountPct,
        discountScope: data.discountScope,
        serviceIds: data.serviceIds.length ? data.serviceIds : undefined,
        validFrom: effectiveValidFrom,
        validTo: rawValidTo,
      },
    });
  }

  async validate(code: string, salonId: string, serviceId?: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });

    if (!promo || !promo.active || promo.salonId !== salonId) {
      throw new DomainException('INVALID_PROMO', 'Invalid promo code', 400);
    }
    const now = new Date();
    if (promo.validFrom && promo.validFrom > now) {
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      const period = promo.validTo
        ? `Offer runs ${fmt(promo.validFrom)} – ${fmt(promo.validTo)}`
        : `Offer starts ${fmt(promo.validFrom)}`;
      throw new DomainException('PROMO_NOT_STARTED', `Promo code is not yet valid. ${period}`, 400);
    }
    if (promo.validTo && promo.validTo < now) {
      const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      throw new DomainException('PROMO_EXPIRED', `Promo code expired on ${fmt(promo.validTo)}`, 400);
    }
    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      throw new DomainException('PROMO_EXHAUSTED', 'Promo code usage limit reached', 400);
    }
    if (serviceId && promo.discountScope !== 'all_services') {
      const ids = promo.serviceIds as string[] | null;
      if (!ids || !ids.includes(serviceId)) {
        throw new DomainException('PROMO_NOT_APPLICABLE', 'Promo code does not apply to this service', 400);
      }
    }
    return promo;
  }

  async incrementUsage(id: string) {
    return this.prisma.promoCode.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
  }
}
