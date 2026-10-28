import { Injectable } from '@nestjs/common';
import { Prisma, Role, SalonStatus } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PlanGuardService } from '../plan-guard/plan-guard.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { SalonsRepository } from './repositories/salons.repository';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';

@Injectable()
export class SalonsService {
  constructor(
    private readonly salonsRepository: SalonsRepository,
    private readonly planGuard: PlanGuardService,
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateSalonDto, ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only salon owners can create salons', 403);
    }
    await this.planGuard.checkSalonLimit(ownerId);
    const existing = await this.salonsRepository.findBySlug(dto.slug);
    if (existing) {
      throw new DomainException('SLUG_IN_USE', 'Slug already taken', 409);
    }
    return this.salonsRepository.create({
      owner: { connect: { id: ownerId } },
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      address: dto.address,
      city: dto.city,
      country: dto.country,
      contactPhone: dto.contactPhone?.trim() || undefined,
      contactEmail: dto.contactEmail?.trim().toLowerCase() || undefined,
      websiteUrl: dto.websiteUrl?.trim() || undefined,
      businessHours:
        dto.businessHours !== undefined ? (dto.businessHours as Prisma.InputJsonValue) : undefined,
      status: SalonStatus.DRAFT,
    } as Prisma.SalonCreateInput);
  }

  async update(salonId: string, dto: UpdateSalonDto, ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only salon owners can update salons', 403);
    }
    const salon = await this.salonsRepository.findById(salonId);
    if (!salon || salon.ownerId !== ownerId) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }
    if (dto.slug !== undefined && dto.slug !== salon.slug) {
      const existing = await this.salonsRepository.findBySlug(dto.slug);
      if (existing) {
        throw new DomainException('SLUG_IN_USE', 'Slug already taken', 409);
      }
    }
    return this.salonsRepository.update(salonId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.contactPhone !== undefined && {
        contactPhone: dto.contactPhone?.trim() || null,
      }),
      ...(dto.contactEmail !== undefined && {
        contactEmail: dto.contactEmail?.trim().toLowerCase() || null,
      }),
      ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl?.trim() || null }),
      ...(dto.businessHours !== undefined && {
        businessHours:
          dto.businessHours === null
            ? Prisma.JsonNull
            : (dto.businessHours as Prisma.InputJsonValue),
      }),
    } as Prisma.SalonUpdateInput);
  }

  async publish(salonId: string, ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only owners can publish', 403);
    }
    const salon = await this.salonsRepository.findById(salonId);
    if (!salon || salon.ownerId !== ownerId) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }
    await this.planGuard.requireApprovedAccount(ownerId);
    return this.salonsRepository.updateStatus(salonId, SalonStatus.PUBLISHED);
  }

  listMine(ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only owners can list salons', 403);
    }
    return this.salonsRepository.listByOwner(ownerId);
  }

  getPublicBySlug(slug: string) {
    return this.salonsRepository.findPublishedWithDetails(slug).then((s) => {
      if (!s || s.status !== SalonStatus.PUBLISHED) {
        throw new DomainException('NOT_FOUND', 'Salon not found', 404);
      }
      return s;
    });
  }

  async getBranchesBySlug(slug: string) {
    const salon = await this.salonsRepository.findBySlug(slug);
    if (!salon || salon.status !== SalonStatus.PUBLISHED) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }
    return this.salonsRepository.findPublishedByOwner(salon.ownerId);
  }

  async setDefault(salonId: string, ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only owners can set a default branch', 403);
    }
    const salon = await this.salonsRepository.findById(salonId);
    if (!salon || salon.ownerId !== ownerId) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }
    return this.salonsRepository.setDefault(ownerId, salonId);
  }

  async setListingImage(salonId: string, file: Express.Multer.File, ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only owners can set a listing image', 403);
    }
    const salon = await this.salonsRepository.findById(salonId);
    if (!salon || salon.ownerId !== ownerId) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }
    if (salon.listingImageUrl) {
      await this.cloudinary.deleteByUrl(salon.listingImageUrl);
    }
    const url = await this.cloudinary.uploadImage(file.buffer, 'salon-listing');
    return this.salonsRepository.update(salonId, { listingImageUrl: url });
  }

  async setCoverImage(salonId: string, galleryItemId: string | null | undefined, ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only owners can set a cover image', 403);
    }
    const salon = await this.salonsRepository.findById(salonId);
    if (!salon || salon.ownerId !== ownerId) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }

    if (!galleryItemId) {
      return this.salonsRepository.update(salonId, { coverImageUrl: null });
    }

    const item = await this.prisma.galleryItem.findFirst({
      where: { id: galleryItemId, salonId },
    });
    if (!item) {
      throw new DomainException('NOT_FOUND', 'Gallery item not found in this salon', 404);
    }

    return this.salonsRepository.update(salonId, { coverImageUrl: item.url });
  }
}
