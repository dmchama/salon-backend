import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  createRegistrationPaymentsApp,
  FakeCloudinary,
  TINY_PNG,
} from './helpers/registration-payments-app';

/** Feature 002 — POST /auth/register with a payment receipt (AC6–AC9). */
describe('Auth register with payment receipt (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cloudinary = new FakeCloudinary();
  const tag = randomUUID().slice(0, 8);
  let planId = '';
  const createdEmails: string[] = [];

  const email = (n: string) => {
    const e = `e2e-reg-${n}-${tag}@example.test`;
    createdEmails.push(e);
    return e;
  };

  const multipart = (
    mail: string,
    file?: { buf: Buffer; name: string; type: string },
  ) => {
    const req = request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .field('email', mail)
      .field('password', 'TestOwner123!')
      .field('role', 'SALON_ADMIN')
      .field('lastName', 'Owner')
      .field('subscriptionPlanId', planId);
    return file
      ? req.attach('receipt', file.buf, {
          filename: file.name,
          contentType: file.type,
        })
      : req;
  };

  beforeAll(async () => {
    app = await createRegistrationPaymentsApp(cloudinary);
    prisma = app.get(PrismaService);
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `E2E paid ${tag}`,
        priceCents: 199_900,
        currency: 'LKR',
        active: true,
      },
    });
    planId = plan.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
      await prisma.subscriptionPlan.deleteMany({ where: { id: planId } });
    }
    await app.close();
  });

  it('still accepts a JSON body without a receipt while the flag is off (AC9, BR11)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: email('json'),
        password: 'TestOwner123!',
        role: 'SALON_ADMIN',
        lastName: 'Owner',
        subscriptionPlanId: planId,
      })
      .expect(201);
    expect(res.body.user.accountStatus).toBe('PENDING');
  });

  it('creates a PENDING owner and a PENDING payment for the plan price (AC7, BR2)', async () => {
    const mail = email('ok');
    const res = await multipart(mail, {
      buf: TINY_PNG,
      name: 'r.png',
      type: 'image/png',
    }).expect(201);
    expect(res.body.accessToken).toBeDefined();
    const payment = await prisma.registrationPayment.findFirst({
      where: { ownerId: res.body.user.id },
    });
    expect(payment).toMatchObject({
      status: 'PENDING',
      amountCents: 199_900,
      currency: 'LKR',
      planId,
    });
    expect(cloudinary.uploads.has(payment!.receiptPublicId)).toBe(true);
  });

  it('rejects a wrong file type with INVALID_RECEIPT_FILE (AC6)', async () => {
    const res = await multipart(email('gif'), {
      buf: Buffer.from('GIF89a'),
      name: 'r.gif',
      type: 'image/gif',
    }).expect(400);
    expect(res.body.code).toBe('INVALID_RECEIPT_FILE');
  });

  it('rejects a file over 5 MB with INVALID_RECEIPT_FILE (AC6)', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
    const res = await multipart(email('big'), {
      buf: big,
      name: 'r.png',
      type: 'image/png',
    }).expect(400);
    expect(res.body.code).toBe('INVALID_RECEIPT_FILE');
  });

  it('creates no account when the upload fails (AC8)', async () => {
    const mail = email('fail');
    cloudinary.failNextUpload = true;
    const res = await multipart(mail, {
      buf: TINY_PNG,
      name: 'r.png',
      type: 'image/png',
    }).expect(502);
    expect(res.body.code).toBe('RECEIPT_UPLOAD_FAILED');
    expect(await prisma.user.findUnique({ where: { email: mail } })).toBeNull();
  });

  it('does not upload anything for a duplicate email (BR9)', async () => {
    const mail = email('dup');
    await multipart(mail, {
      buf: TINY_PNG,
      name: 'r.png',
      type: 'image/png',
    }).expect(201);
    const before = cloudinary.uploads.size;
    const res = await multipart(mail, {
      buf: TINY_PNG,
      name: 'r.png',
      type: 'image/png',
    }).expect(409);
    expect(res.body.code).toBe('EMAIL_IN_USE');
    expect(cloudinary.uploads.size).toBe(before);
  });

  it('requires a receipt once REGISTRATION_RECEIPT_REQUIRED is on (AC9, BR1)', async () => {
    const config = app.get(ConfigService);
    const original = config.get.bind(config);
    const spy = jest
      .spyOn(config, 'get')
      .mockImplementation(((key: string) =>
        key === 'registrationReceiptRequired'
          ? true
          : original(key)) as typeof config.get);
    try {
      const res = await multipart(email('req')).expect(400);
      expect(res.body.code).toBe('RECEIPT_REQUIRED');
    } finally {
      spy.mockRestore();
    }
  });
});
