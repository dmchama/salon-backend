import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServicesRepository } from './repositories/services.repository';

@Injectable()
export class ServicesOfferedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servicesRepository: ServicesRepository,
  ) {}

  async create(dto: CreateServiceDto, ownerId: string, role: Role) {
    if (role !== Role.OWNER) {
      throw new DomainException('FORBIDDEN', 'Only owners manage services', 403);
    }
    const salon = await this.prisma.salon.findFirst({
      where: { id: dto.salonId, ownerId },
    });
    if (!salon) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }
    return this.servicesRepository.create({
      salon: { connect: { id: dto.salonId } },
      name: dto.name,
      description: dto.description,
      durationMin: dto.durationMin,
      priceCents: dto.priceCents,
    });
  }

  listForSalon(salonId: string) {
    return this.servicesRepository.listForSalon(salonId);
  }
}
