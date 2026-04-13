import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateGalleryItemDto } from './dto/create-gallery-item.dto';

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  async addItem(dto: CreateGalleryItemDto, ownerId: string, role: Role) {
    if (role !== Role.OWNER) {
      throw new DomainException('FORBIDDEN', 'Only owners manage gallery', 403);
    }
    const salon = await this.prisma.salon.findFirst({
      where: { id: dto.salonId, ownerId },
    });
    if (!salon) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }
    return this.prisma.galleryItem.create({
      data: {
        salonId: dto.salonId,
        url: dto.url,
        caption: dto.caption,
      },
    });
  }

  listForSalon(salonId: string) {
    return this.prisma.galleryItem.findMany({
      where: { salonId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
