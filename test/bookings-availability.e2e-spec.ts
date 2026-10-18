import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  addDays,
  colomboDateString,
} from '../src/modules/bookings/domain/availability.policy';

/** Feature 001 — availability endpoint and working-hours rule on POST /bookings. */
describe('Bookings availability (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tag = randomUUID().slice(0, 8);
  const ids = { owner: '', plan: '', salon: '', service: '' };

  const today = colomboDateString(new Date());
  const openDay = addDays(today, 7);
  const closedDay = addDays(today, 8);
  const weekdayCode = (date: string) =>
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][
      new Date(`${date}T00:00:00Z`).getUTCDay()
    ];
  const at = (date: string, hhmm: string) =>
    new Date(`${date}T${hhmm}:00+05:30`).toISOString();

  const availability = (q: Record<string, string>) =>
    request(app.getHttpServer()).get('/api/v1/bookings/availability').query(q);
  const book = (startAt: string) =>
    request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        salonId: ids.salon,
        serviceId: ids.service,
        startAt,
        guestName: 'E2E Guest',
        guestEmail: `e2e-guest-${tag}@example.test`,
        guestPhone: '+94770000000',
      });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const hours: Record<
      string,
      { closed: boolean; open: string; close: string }
    > = {};
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      hours[day] =
        day === weekdayCode(closedDay)
          ? { closed: true, open: '', close: '' }
          : { closed: false, open: '09:00', close: '18:00' };
    }

    const owner = await prisma.user.create({
      data: {
        email: `e2e-owner-${tag}@example.test`,
        passwordHash: 'x',
        role: 'SALON_ADMIN',
        accountStatus: 'ACTIVE',
      },
    });
    const plan = await prisma.subscriptionPlan.create({
      data: { name: `E2E plan ${tag}`, priceCents: 0, active: false },
    });
    await prisma.ownerSubscription.create({
      data: {
        ownerId: owner.id,
        planId: plan.id,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000 * 30),
      },
    });
    const salon = await prisma.salon.create({
      data: {
        ownerId: owner.id,
        name: `E2E Salon ${tag}`,
        slug: `e2e-salon-${tag}`,
        status: 'PUBLISHED',
        businessHours: hours,
      },
    });
    const service = await prisma.service.create({
      data: {
        salonId: salon.id,
        name: 'E2E Cut',
        durationMin: 60,
        priceCents: 100000,
      },
    });
    Object.assign(ids, {
      owner: owner.id,
      plan: plan.id,
      salon: salon.id,
      service: service.id,
    });
  });

  afterAll(async () => {
    if (prisma && ids.owner) {
      await prisma.booking.deleteMany({ where: { salonId: ids.salon } });
      await prisma.service.deleteMany({ where: { salonId: ids.salon } });
      await prisma.salon.deleteMany({ where: { id: ids.salon } });
      await prisma.ownerSubscription.deleteMany({
        where: { ownerId: ids.owner },
      });
      await prisma.subscriptionPlan.deleteMany({ where: { id: ids.plan } });
      await prisma.user.deleteMany({ where: { id: ids.owner } });
    }
    await app.close();
  });

  it('returns slots inside working hours and closed days (AC4, AC6, AC7)', async () => {
    const res = await availability({
      salonId: ids.salon,
      serviceId: ids.service,
      from: openDay,
      days: '2',
    }).expect(200);
    expect(res.body.timezone).toBe('Asia/Colombo');
    expect(res.body.slotIntervalMin).toBe(15);
    const [open, closed] = res.body.days;
    expect(open).toMatchObject({
      date: openDay,
      closed: false,
      open: '09:00',
      close: '18:00',
    });
    expect(open.slots[0]).toBe('09:00');
    expect(open.slots[open.slots.length - 1]).toBe('17:00');
    expect(closed).toMatchObject({
      date: closedDay,
      closed: true,
      open: null,
      close: null,
      slots: [],
    });
  });

  it('hides booked times and exposes no guest data (AC9, BR6)', async () => {
    await book(at(openDay, '10:00')).expect(201);
    const res = await availability({
      salonId: ids.salon,
      serviceId: ids.service,
      from: openDay,
      days: '1',
    }).expect(200);
    const slots: string[] = res.body.days[0].slots;
    expect(slots).toContain('09:00');
    expect(slots).not.toContain('09:15');
    expect(slots).not.toContain('10:45');
    expect(slots).toContain('11:00');
    expect(JSON.stringify(res.body)).not.toContain('e2e-guest');
  });

  it('second booking of the same time gets 409 SLOT_TAKEN (AC17)', async () => {
    const res = await book(at(openDay, '10:00')).expect(409);
    expect(res.body.code).toBe('SLOT_TAKEN');
  });

  it('rejects bookings outside working hours with OUTSIDE_BUSINESS_HOURS (AC16)', async () => {
    for (const startAt of [
      at(openDay, '08:30'),
      at(openDay, '17:30'),
      at(closedDay, '10:00'),
    ]) {
      const res = await book(startAt).expect(400);
      expect(res.body.code).toBe('OUTSIDE_BUSINESS_HOURS');
    }
  });

  it('returns 404 for unknown salon or service and 400 for out-of-range dates', async () => {
    let res = await availability({
      salonId: randomUUID(),
      serviceId: ids.service,
    }).expect(404);
    expect(res.body.code).toBe('SALON_NOT_FOUND');
    res = await availability({
      salonId: ids.salon,
      serviceId: randomUUID(),
    }).expect(404);
    expect(res.body.code).toBe('SERVICE_NOT_FOUND');
    res = await availability({
      salonId: ids.salon,
      serviceId: ids.service,
      from: addDays(today, -1),
    }).expect(400);
    expect(res.body.code).toBe('INVALID_RANGE');
    res = await availability({
      salonId: ids.salon,
      serviceId: ids.service,
      from: addDays(today, 59),
      days: '2',
    }).expect(400);
    expect(res.body.code).toBe('INVALID_RANGE');
  });
});
