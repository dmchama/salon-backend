import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';

describe('Auth register SALON_ADMIN (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts non-UUID subscriptionPlanId (e.g. seed id) for SALON_ADMIN register', async () => {
    const plansRes = await request(app.getHttpServer()).get('/api/v1/subscription-plans').expect(200);
    const plans = plansRes.body as Array<{ id: string; active: boolean }>;
    const seedPlan = plans.find((p) => p.id === 'seed-plan-basic');
    expect(seedPlan).toBeDefined();

    const email = `e2e-owner-${randomUUID()}@example.com`;
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'TestOwner123!',
        role: 'SALON_ADMIN',
        firstName: 'E2E',
        lastName: 'Owner',
        subscriptionPlanId: 'seed-plan-basic',
      })
      .expect(201);

    expect(registerRes.body.accessToken).toBeDefined();
    expect(registerRes.body.user.email).toBe(email);
    expect(registerRes.body.user.role).toBe('SALON_ADMIN');
  });
});
