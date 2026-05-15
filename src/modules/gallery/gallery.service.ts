import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PlanGuardService } from '../plan-guard/plan-guard.service';
import { CloudinaryService } from './cloudinary.service';

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planGuard: PlanGuardService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async addItemFromUpload(
    file: Express.Multer.File,
    salonId: string,
    caption: string | undefined,
    ownerId: string,
    role: Role,
  ) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only owners manage gallery', 403);
    }
    const salon = await this.prisma.salon.findFirst({ where: { id: salonId, ownerId } });
    if (!salon) throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    await this.planGuard.checkGalleryLimit(ownerId, salonId);

    const url = await this.cloudinary.uploadImage(file.buffer, 'salon-gallery');

    return this.prisma.galleryItem.create({
      data: { salonId, url, caption },
    });
  }

  listForSalon(salonId: string) {
    return this.prisma.galleryItem.findMany({
      where: { salonId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async remove(itemId: string, ownerId: string, role: Role) {
    if (role !== Role.SALON_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Only owners manage gallery', 403);
    }
    const item = await this.prisma.galleryItem.findFirst({
      where: { id: itemId },
      include: { salon: true },
    });
    if (!item || item.salon.ownerId !== ownerId) {
      throw new DomainException('NOT_FOUND', 'Gallery item not found', 404);
    }
    await this.prisma.galleryItem.delete({ where: { id: itemId } });
  }
}
