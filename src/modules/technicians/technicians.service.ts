import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';

@Injectable()
export class TechniciansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTechnicianDto, ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only salon owners manage technicians', 403);
    }
    const salon = await this.prisma.salon.findFirst({
      where: { id: dto.salonId, ownerId },
    });
    if (!salon) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }
    return this.prisma.technician.create({
      data: {
        salonId: dto.salonId,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        specialization: dto.specialization?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async listManageForSalon(salonId: string, ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only salon owners manage technicians', 403);
    }
    const salon = await this.prisma.salon.findFirst({
      where: { id: salonId, ownerId },
    });
    if (!salon) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }
    return this.prisma.technician.findMany({
      where: { salonId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  listForSalonPublic(salonId: string) {
    return this.prisma.technician.findMany({
      where: { salonId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async update(technicianId: string, dto: UpdateTechnicianDto, ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only salon owners manage technicians', 403);
    }
    const existing = await this.prisma.technician.findFirst({
      where: { id: technicianId },
      include: { salon: true },
    });
    if (!existing || existing.salon.ownerId !== ownerId) {
      throw new DomainException('NOT_FOUND', 'Technician not found', 404);
    }
    return this.prisma.technician.update({
      where: { id: technicianId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email?.trim().toLowerCase() || null }),
        ...(dto.specialization !== undefined && { specialization: dto.specialization?.trim() || null }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }
}
