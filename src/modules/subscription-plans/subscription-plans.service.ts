import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { SubscriptionPlansRepository } from './repositories/subscription-plans.repository';

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly subscriptionPlansRepository: SubscriptionPlansRepository) {}

  listPublic() {
    return this.subscriptionPlansRepository.findActive();
  }

  async listAdmin(role: Role) {
    this.requireAdmin(role);
    const [plans, counts] = await Promise.all([
      this.subscriptionPlansRepository.findAll(),
      this.subscriptionPlansRepository.activeSubscriberCounts(),
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c.planId, c._count.id]));
    return plans.map((p) => ({
      ...p,
      features: (p.features as string[] | null) ?? [],
      subscriberCount: countMap[p.id] ?? 0,
    }));
  }

  create(dto: CreatePlanDto, role: Role) {
    this.requireAdmin(role);
    return this.subscriptionPlansRepository.create({
      name: dto.name,
      description: dto.description,
      priceCents: dto.priceCents,
      currency: dto.currency ?? 'LKR',
      intervalMonths: dto.intervalMonths ?? 1,
      features: dto.features ? (dto.features as unknown as Prisma.InputJsonValue) : [],
      active: true,
    });
  }

  async update(id: string, dto: UpdatePlanDto, role: Role) {
    this.requireAdmin(role);
    const existing = await this.subscriptionPlansRepository.findById(id);
    if (!existing) {
      throw new DomainException('NOT_FOUND', 'Plan not found', 404);
    }
    const data: Prisma.SubscriptionPlanUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priceCents !== undefined) data.priceCents = dto.priceCents;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.intervalMonths !== undefined) data.intervalMonths = dto.intervalMonths;
    if (dto.features !== undefined) data.features = dto.features as unknown as Prisma.InputJsonValue;
    if (dto.active !== undefined) data.active = dto.active;
    return this.subscriptionPlansRepository.update(id, data);
  }

  async deletePlan(id: string, role: Role) {
    this.requireAdmin(role);
    const existing = await this.subscriptionPlansRepository.findById(id);
    if (!existing) {
      throw new DomainException('NOT_FOUND', 'Plan not found', 404);
    }
    const counts = await this.subscriptionPlansRepository.activeSubscriberCounts();
    const active = counts.find((c) => c.planId === id)?._count.id ?? 0;
    if (active > 0) {
      throw new DomainException(
        'PLAN_HAS_SUBSCRIBERS',
        `Cannot delete plan with ${active} active subscriber${active > 1 ? 's' : ''}. Deactivate it instead.`,
        409,
      );
    }
    return this.subscriptionPlansRepository.delete(id);
  }

  private requireAdmin(role: Role) {
    if (role !== Role.SUPER_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Admin only', 403);
    }
  }
}
