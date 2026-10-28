import { INestApplication } from '@nestjs/common';
import { User } from '@prisma/client';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  bearer,
  createRegistrationPaymentsApp,
  FakeCloudinary,
  notificationsSpy,
  TINY_PNG,
} from './helpers/registration-payments-app';

/** Feature 002 — owner receipt, admin review, pending-account gates, payment details. */
describe('Registration payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cloudinary = new FakeCloudinary();
  const tag = randomUUID().slice(0, 8);
  let planId = '';
  let admin: User;
  const owners: User[] = [];
  const http = () => request(app.getHttpServer());

  /** A PENDING owner with an ACTIVE subscription and (optionally) a PENDING receipt. */
  async function makeOwner(withReceipt = true) {
    const owner = await prisma.user.create({
      data: {
        email: `e2e-rp-${owners.length}-${tag}@example.test`,
        passwordHash: 'x',
        role: 'SALON_ADMIN',
        accountStatus: 'PENDING',
        firstName: 'Pending',
      },
    });
    owners.push(owner);
    await prisma.ownerSubscription.create({
      data: {
        ownerId: owner.id,
        planId,
        startsAt: new Date('2026-01-01T00:00:00Z'),
        expiresAt: new Date('2026-02-01T00:00:00Z'),
      },
    });
    const payment = withReceipt
      ? await prisma.registrationPayment.create({
          data: {
            ownerId: owner.id,
            planId,
            amountCents: 199_900,
            currency: 'LKR',
            receiptPublicId: `registration-receipts/seed-${owner.id}`,
            receiptFormat: 'png',
          },
        })
      : null;
    return { owner, payment, auth: bearer(app, owner) };
  }

  beforeAll(async () => {
    app = await createRegistrationPaymentsApp(cloudinary);
    prisma = app.get(PrismaService);
    planId = (
      await prisma.subscriptionPlan.create({
        data: {
          name: `E2E RP ${tag}`,
          priceCents: 199_900,
          currency: 'LKR',
          intervalMonths: 1,
          active: false,
        },
      })
    ).id;
    admin = await prisma.user.create({
      data: {
        email: `e2e-rp-admin-${tag}@example.test`,
        passwordHash: 'x',
        role: 'SUPER_ADMIN',
        accountStatus: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      const ids = owners.map((o) => o.id);
      await prisma.booking.deleteMany({
        where: { salon: { ownerId: { in: ids } } },
      });
      await prisma.service.deleteMany({
        where: { salon: { ownerId: { in: ids } } },
      });
      await prisma.salon.deleteMany({ where: { ownerId: { in: ids } } });
      await prisma.user.deleteMany({
        where: { id: { in: [...ids, admin?.id].filter(Boolean) as string[] } },
      });
      await prisma.subscriptionPlan.deleteMany({ where: { id: planId } });
    }
    await app.close();
  });

  beforeEach(() =>
    notificationsSpy.enqueueRegistrationPaymentReviewed.mockClear(),
  );

  // ── Owner side ─────────────────────────────────────────────────────────

  it('GET /registration-payments/me returns status and a signed receipt URL (AC10)', async () => {
    const { auth } = await makeOwner();
    const res = await http()
      .get('/api/v1/registration-payments/me')
      .set('Authorization', auth)
      .expect(200);
    expect(res.body.accountStatus).toBe('PENDING');
    expect(res.body.payment).toMatchObject({
      status: 'PENDING',
      amountCents: 199_900,
      currency: 'LKR',
      receiptFormat: 'png',
    });
    expect(res.body.payment.receiptUrl).toContain('signature=');
  });

  it('re-upload is refused while the receipt is pending (AC13)', async () => {
    const { auth } = await makeOwner();
    const res = await http()
      .post('/api/v1/registration-payments/me/receipt')
      .set('Authorization', auth)
      .attach('receipt', TINY_PNG, {
        filename: 'r.png',
        contentType: 'image/png',
      })
      .expect(409);
    expect(res.body.code).toBe('PAYMENT_ALREADY_PENDING');
  });

  it('after rejection the owner can upload a new receipt, which is PENDING again (AC13, AC18)', async () => {
    const { auth, payment } = await makeOwner();
    await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/reject`)
      .set('Authorization', bearer(app, admin))
      .send({ reason: 'Amount does not match' })
      .expect(200);

    const me = await http()
      .get('/api/v1/registration-payments/me')
      .set('Authorization', auth)
      .expect(200);
    expect(me.body.payment).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Amount does not match',
    });
    expect(me.body.accountStatus).toBe('PENDING');

    const res = await http()
      .post('/api/v1/registration-payments/me/receipt')
      .set('Authorization', auth)
      .attach('receipt', TINY_PNG, {
        filename: 'r.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(res.body.payment.status).toBe('PENDING');
    expect(res.body.payment.id).not.toBe(payment!.id);
  });

  it('re-upload is refused once the account is active (AC13)', async () => {
    const { owner, auth } = await makeOwner(false);
    await prisma.user.update({
      where: { id: owner.id },
      data: { accountStatus: 'ACTIVE' },
    });
    const res = await http()
      .post('/api/v1/registration-payments/me/receipt')
      .set('Authorization', auth)
      .attach('receipt', TINY_PNG, {
        filename: 'r.png',
        contentType: 'image/png',
      })
      .expect(409);
    expect(res.body.code).toBe('ACCOUNT_ALREADY_ACTIVE');
  });

  // ── Admin side ─────────────────────────────────────────────────────────

  it('GET /admin/owners includes the latest registration payment (AC14)', async () => {
    const { owner, payment } = await makeOwner();
    const res = await http()
      .get('/api/v1/admin/owners')
      .set('Authorization', bearer(app, admin))
      .expect(200);
    const row = res.body.find((o: { id: string }) => o.id === owner.id);
    expect(row.registrationPayment).toMatchObject({
      id: payment!.id,
      status: 'PENDING',
    });
  });

  it('GET /admin/owners/:id/registration-payment shows receipt, plan, amount and history (AC15)', async () => {
    const { owner, payment } = await makeOwner();
    const res = await http()
      .get(`/api/v1/admin/owners/${owner.id}/registration-payment`)
      .set('Authorization', bearer(app, admin))
      .expect(200);
    expect(res.body.owner).toMatchObject({
      id: owner.id,
      email: owner.email,
      accountStatus: 'PENDING',
    });
    expect(res.body.payment).toMatchObject({
      id: payment!.id,
      planName: `E2E RP ${tag}`,
      amountCents: 199_900,
    });
    expect(res.body.payment.receiptUrl).toContain('signature=');
    expect(res.body.history).toEqual([]);
  });

  it('approve activates the account, restarts the subscription and notifies (AC16, BR5, BR10)', async () => {
    const { owner, payment } = await makeOwner();
    const before = Date.now();
    await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/approve`)
      .set('Authorization', bearer(app, admin))
      .expect(200);

    const user = await prisma.user.findUnique({ where: { id: owner.id } });
    expect(user!.accountStatus).toBe('ACTIVE');
    const p = await prisma.registrationPayment.findUnique({
      where: { id: payment!.id },
    });
    expect(p).toMatchObject({ status: 'APPROVED', reviewedById: admin.id });
    const sub = await prisma.ownerSubscription.findFirst({
      where: { ownerId: owner.id },
    });
    expect(sub!.startsAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    const expected = new Date(sub!.startsAt);
    expected.setUTCMonth(expected.getUTCMonth() + 1);
    expect(
      Math.abs(sub!.expiresAt.getTime() - expected.getTime()),
    ).toBeLessThan(4 * 86_400_000);
    expect(
      notificationsSpy.enqueueRegistrationPaymentReviewed,
    ).toHaveBeenCalledWith('approved', {
      registrationPaymentId: payment!.id,
    });
  });

  it('reject keeps the account pending, stores the reason and notifies (AC18)', async () => {
    const { owner, payment } = await makeOwner();
    await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/reject`)
      .set('Authorization', bearer(app, admin))
      .send({ reason: 'Receipt is unreadable' })
      .expect(200);
    expect(
      (await prisma.user.findUnique({ where: { id: owner.id } }))!
        .accountStatus,
    ).toBe('PENDING');
    expect(
      await prisma.registrationPayment.findUnique({
        where: { id: payment!.id },
      }),
    ).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Receipt is unreadable',
    });
    expect(
      notificationsSpy.enqueueRegistrationPaymentReviewed,
    ).toHaveBeenCalledWith('rejected', {
      registrationPaymentId: payment!.id,
    });
  });

  it('reject needs a reason (AC18)', async () => {
    const { payment } = await makeOwner();
    await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/reject`)
      .set('Authorization', bearer(app, admin))
      .send({ reason: '' })
      .expect(400);
  });

  it('a reviewed payment cannot be reviewed again; unknown ids are 404 (AC17)', async () => {
    const { payment } = await makeOwner();
    const auth = bearer(app, admin);
    await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/approve`)
      .set('Authorization', auth)
      .expect(200);
    let res = await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/approve`)
      .set('Authorization', auth)
      .expect(409);
    expect(res.body.code).toBe('PAYMENT_NOT_PENDING');
    res = await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/reject`)
      .set('Authorization', auth)
      .send({ reason: 'late' })
      .expect(409);
    expect(res.body.code).toBe('PAYMENT_NOT_PENDING');
    res = await http()
      .patch(`/api/v1/admin/registration-payments/${randomUUID()}/approve`)
      .set('Authorization', auth)
      .expect(404);
    expect(res.body.code).toBe('PAYMENT_NOT_FOUND');
  });

  it('approve still succeeds when queueing the notification fails (BR12)', async () => {
    const { payment } = await makeOwner();
    notificationsSpy.enqueueRegistrationPaymentReviewed.mockRejectedValueOnce(
      new Error('redis down'),
    );
    await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/approve`)
      .set('Authorization', bearer(app, admin))
      .expect(200);
  });

  it('a SALON_ADMIN cannot use admin review endpoints (AC19)', async () => {
    const { owner, payment, auth } = await makeOwner();
    await http()
      .get(`/api/v1/admin/owners/${owner.id}/registration-payment`)
      .set('Authorization', auth)
      .expect(403);
    await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/approve`)
      .set('Authorization', auth)
      .expect(403);
    await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/reject`)
      .set('Authorization', auth)
      .send({ reason: 'x' })
      .expect(403);
    await http()
      .patch('/api/v1/admin/website/payment-details')
      .set('Authorization', auth)
      .send({ bankName: 'B', accountName: 'A', accountNumber: '1' })
      .expect(403);
  });

  // ── Pending-account gates ──────────────────────────────────────────────

  it('a PENDING owner cannot publish or receive bookings until approved (AC11, AC12)', async () => {
    const { owner, payment, auth } = await makeOwner();
    const hours = Object.fromEntries(
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [
        d,
        { closed: false, open: '00:00', close: '23:59' },
      ]),
    );
    const salon = await prisma.salon.create({
      data: {
        ownerId: owner.id,
        name: `RP Salon ${tag}`,
        slug: `rp-salon-${tag}-${owners.length}`,
        businessHours: hours,
      },
    });
    const service = await prisma.service.create({
      data: {
        salonId: salon.id,
        name: 'Cut',
        durationMin: 30,
        priceCents: 1000,
      },
    });

    let res = await http()
      .post(`/api/v1/salons/${salon.id}/publish`)
      .set('Authorization', auth)
      .expect(403);
    expect(res.body.code).toBe('ACCOUNT_NOT_APPROVED');

    // Even if the admin publishes it, guests cannot book while the owner is pending.
    await prisma.salon.update({
      where: { id: salon.id },
      data: { status: 'PUBLISHED' },
    });
    const startAt = new Date(Date.now() + 3 * 86_400_000);
    startAt.setUTCHours(6, 0, 0, 0);
    const booking = {
      salonId: salon.id,
      serviceId: service.id,
      startAt: startAt.toISOString(),
      guestName: 'Guest',
      guestEmail: `guest-${tag}@example.test`,
      guestPhone: '+94770000000',
    };
    res = await http().post('/api/v1/bookings').send(booking).expect(403);
    expect(res.body.code).toBe('ACCOUNT_NOT_APPROVED');

    await http()
      .patch(`/api/v1/admin/registration-payments/${payment!.id}/approve`)
      .set('Authorization', bearer(app, admin))
      .expect(200);
    await http()
      .post(`/api/v1/salons/${salon.id}/publish`)
      .set('Authorization', auth)
      .expect(201);
    await http().post('/api/v1/bookings').send(booking).expect(201);
  });

  // ── Payment details ────────────────────────────────────────────────────

  it('admin edits payment details and the public settings show them; blank → null (AC20, AC21)', async () => {
    const auth = bearer(app, admin);
    const previous = await prisma.websiteSetting.findUnique({
      where: { key: 'paymentDetails' },
    });
    try {
      await http()
        .patch('/api/v1/admin/website/payment-details')
        .set('Authorization', auth)
        .send({
          bankName: 'E2E Bank',
          accountName: 'E2E Ltd',
          accountNumber: '123',
          branch: 'Kandy',
        })
        .expect(200);
      let res = await http().get('/api/v1/website-settings').expect(200);
      expect(res.body.paymentDetails).toEqual({
        bankName: 'E2E Bank',
        accountName: 'E2E Ltd',
        accountNumber: '123',
        branch: 'Kandy',
        instructions: '',
      });

      await http()
        .patch('/api/v1/admin/website/payment-details')
        .set('Authorization', auth)
        .send({ bankName: '', accountName: 'E2E Ltd', accountNumber: '123' })
        .expect(400);

      await prisma.websiteSetting.update({
        where: { key: 'paymentDetails' },
        data: { value: { bankName: ' ' } },
      });
      res = await http().get('/api/v1/website-settings').expect(200);
      expect(res.body.paymentDetails).toBeNull();
    } finally {
      if (previous) {
        await prisma.websiteSetting.update({
          where: { key: 'paymentDetails' },
          data: { value: previous.value as object },
        });
      } else {
        await prisma.websiteSetting.deleteMany({
          where: { key: 'paymentDetails' },
        });
      }
    }
  });
});
