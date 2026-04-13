import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { CreatePlanDto } from './dto/create-plan.dto';
import { SubscriptionPlansRepository } from './repositories/subscription-plans.repository';

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly subscriptionPlansRepository: SubscriptionPlansRepository) {}

  listPublic() {
    return this.subscriptionPlansRepository.findActive();
  }

  create(dto: CreatePlanDto, role: Role) {
    if (role !== Role.ADMIN) {
      throw new DomainException('FORBIDDEN', 'Admin only', 403);
    }
    return this.subscriptionPlansRepository.create({
      name: dto.name,
      description: dto.description,
      priceCents: dto.priceCents,
      intervalMonths: dto.intervalMonths ?? 1,
      active: true,
    });
  }
}
