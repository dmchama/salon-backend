import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';
import { assertValidPhoto } from './domain/technician-photo.policy';

@Injectable()
export class TechniciansService {
  private readonly logger = new Logger(TechniciansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

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

  /** Upload or replace a team member's public photo (spec 005). The old image is deleted best-effort. */
  async setPhoto(technicianId: string, file: Express.Multer.File | undefined, ownerId: string) {
    const existing = await this.findOwned(technicianId, ownerId);
    if (!file) throw new DomainException('INVALID_IMAGE_FILE', 'Please choose a photo', 400);
    assertValidPhoto(file.mimetype, file.size);
    this.logger.log(`[setPhoto] START technician=${technicianId}`);
    let photoUrl: string;
    try {
      photoUrl = await this.cloudinary.uploadImage(file.buffer, 'technician-photos');
    } catch (err) {
      this.logger.error(`[setPhoto] FAIL technician=${technicianId}: ${(err as Error)?.message ?? err}`);
      throw new DomainException('IMAGE_UPLOAD_FAILED', 'Could not upload the photo. Please try again.', 502);
    }
    const updated = await this.prisma.technician.update({ where: { id: technicianId }, data: { photoUrl } });
    if (existing.photoUrl) await this.cloudinary.deleteByUrl(existing.photoUrl);
    this.logger.log(`[setPhoto] OK technician=${technicianId}`);
    return updated;
  }

  async removePhoto(technicianId: string, ownerId: string) {
    const existing = await this.findOwned(technicianId, ownerId);
    const updated = await this.prisma.technician.update({ where: { id: technicianId }, data: { photoUrl: null } });
    if (existing.photoUrl) await this.cloudinary.deleteByUrl(existing.photoUrl);
    return updated;
  }

  /** Technician of one of the owner's salons, or 404 (same rule as update). */
  private async findOwned(technicianId: string, ownerId: string) {
    const existing = await this.prisma.technician.findFirst({
      where: { id: technicianId },
      include: { salon: true },
    });
    if (!existing || existing.salon.ownerId !== ownerId) {
      throw new DomainException('NOT_FOUND', 'Technician not found', 404);
    }
    return existing;
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
