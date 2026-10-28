import { INestApplication } from '@nestjs/common';
import { User } from '@prisma/client';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import {
  bearer,
  createRegistrationPaymentsApp,
  FakeCloudinary,
  TINY_PNG,
} from './helpers/registration-payments-app';

/** Feature 005: team member photo upload / remove. */
describe('Technician photos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const cloudinary = new FakeCloudinary();
  const tag = randomUUID().slice(0, 8);
  const users: User[] = [];
  let salonId = '';
  let technicianId = '';
  let ownerAuth = '';
  let otherAuth = '';
  const http = () => request(app.getHttpServer());

  const upload = (
    auth: string,
    file: { buf: Buffer; name: string; type: string } = {
      buf: TINY_PNG,
      name: 'me.png',
      type: 'image/png',
    },
  ) =>
    http()
      .post(`/api/v1/technicians/${technicianId}/photo`)
      .set('Authorization', auth)
      .attach('photo', file.buf, {
        filename: file.name,
        contentType: file.type,
      });

  beforeAll(async () => {
    app = await createRegistrationPaymentsApp(cloudinary);
    prisma = app.get(PrismaService);
    for (const n of ['owner', 'other']) {
      users.push(
        await prisma.user.create({
          data: {
            email: `e2e-photo-${n}-${tag}@example.test`,
            passwordHash: 'x',
            role: 'SALON_ADMIN',
            accountStatus: 'ACTIVE',
          },
        }),
      );
    }
    const salon = await prisma.salon.create({
      data: {
        ownerId: users[0].id,
        name: `Photo ${tag}`,
        slug: `e2e-photo-${tag}`,
      },
    });
    salonId = salon.id;
    technicianId = (
      await prisma.technician.create({ data: { salonId, name: 'Ishara' } })
    ).id;
    ownerAuth = bearer(app, users[0]);
    otherAuth = bearer(app, users[1]);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.technician.deleteMany({ where: { salonId } });
      await prisma.salon.deleteMany({ where: { id: salonId } });
      await prisma.user.deleteMany({
        where: { id: { in: users.map((u) => u.id) } },
      });
    }
    await app.close();
  });

  it('uploads a photo and returns the technician with photoUrl (AC1, AC2)', async () => {
    const res = await upload(ownerAuth).expect(201);
    expect(res.body.photoUrl).toMatch(/technician-photos\/fake-\d+\.jpg$/);
  });

  it('replacing the photo deletes the old image (AC4, BR4)', async () => {
    const before = (await prisma.technician.findUnique({
      where: { id: technicianId },
    }))!.photoUrl;
    const res = await upload(ownerAuth).expect(201);
    expect(res.body.photoUrl).not.toBe(before);
    expect(cloudinary.deletedUrls).toContain(before);
  });

  it('public team list includes photoUrl (AC10)', async () => {
    const res = await http()
      .get(`/api/v1/technicians/salon/${salonId}`)
      .expect(200);
    expect(res.body[0].photoUrl).toMatch(/^https:\/\/fake\.cloudinary\.test\//);
  });

  it('rejects a wrong type or an oversized file with INVALID_IMAGE_FILE (AC6)', async () => {
    let res = await upload(ownerAuth, {
      buf: Buffer.from('%PDF'),
      name: 'x.pdf',
      type: 'application/pdf',
    }).expect(400);
    expect(res.body.code).toBe('INVALID_IMAGE_FILE');
    res = await upload(ownerAuth, {
      buf: Buffer.alloc(1024 * 1024 + 1, 1),
      name: 'big.png',
      type: 'image/png',
    }).expect(400);
    expect(res.body.code).toBe('INVALID_IMAGE_FILE');
    res = await http()
      .post(`/api/v1/technicians/${technicianId}/photo`)
      .set('Authorization', ownerAuth)
      .expect(400);
    expect(res.body.code).toBe('INVALID_IMAGE_FILE');
  });

  it('a storage failure returns 502 IMAGE_UPLOAD_FAILED and keeps the old photo (AC8)', async () => {
    const before = (await prisma.technician.findUnique({
      where: { id: technicianId },
    }))!.photoUrl;
    cloudinary.failNextUpload = true;
    const res = await upload(ownerAuth).expect(502);
    expect(res.body.code).toBe('IMAGE_UPLOAD_FAILED');
    expect(
      (await prisma.technician.findUnique({ where: { id: technicianId } }))!
        .photoUrl,
    ).toBe(before);
  });

  it("another owner can't upload or remove the photo (AC9)", async () => {
    await upload(otherAuth).expect(404);
    await http()
      .delete(`/api/v1/technicians/${technicianId}/photo`)
      .set('Authorization', otherAuth)
      .expect(404);
  });

  it('removing the photo clears photoUrl and deletes the image (AC5)', async () => {
    const before = (await prisma.technician.findUnique({
      where: { id: technicianId },
    }))!.photoUrl;
    const res = await http()
      .delete(`/api/v1/technicians/${technicianId}/photo`)
      .set('Authorization', ownerAuth)
      .expect(200);
    expect(res.body.photoUrl).toBeNull();
    expect(cloudinary.deletedUrls).toContain(before);
  });
});
