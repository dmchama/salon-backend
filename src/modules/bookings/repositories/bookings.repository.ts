import { Injectable } from '@nestjs/common';
import { Booking, BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class BookingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.BookingCreateInput): Promise<Booking> {
    return this.prisma.booking.create({ data });
  }

  findById(id: string): Promise<Booking | null> {
    return this.prisma.booking.findUnique({ where: { id } });
  }

  findByIdWithRelations(id: string) {
    return this.prisma.booking.findUnique({
      where: { id },
      include: { customer: true, salon: true, service: true, technician: true },
    });
  }

  listForSalonOwner(salonId: string, ownerId: string) {
    return this.prisma.booking.findMany({
      where: { salon: { id: salonId, ownerId } },
      orderBy: { startAt: 'desc' },
      include: { customer: true, service: true, technician: true },
    });
  }

  listForSalon(salonId: string) {
    return this.prisma.booking.findMany({
      where: { salonId },
      orderBy: { startAt: 'desc' },
      include: { customer: true, service: true, technician: true },
    });
  }

  updateStatus(id: string, status: BookingStatus): Promise<Booking> {
    return this.prisma.booking.update({ where: { id }, data: { status } });
  }

  updateSchedule(id: string, startAt: Date, endAt: Date): Promise<Booking> {
    return this.prisma.booking.update({ where: { id }, data: { startAt, endAt } });
  }

  hasOverlappingBooking(salonId: string, startAt: Date, endAt: Date, excludeId?: string) {
    return this.prisma.booking.findFirst({
      where: {
        salonId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        status: { not: BookingStatus.CANCELLED },
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
    });
  }
}
