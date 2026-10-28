import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { CloudinaryService } from '../../src/common/cloudinary/cloudinary.service';
import { NotificationProducerService } from '../../src/modules/notifications/notification-producer.service';

/** In-memory stand-in for Cloudinary so e2e tests never touch the network (spec 002, T010). */
export class FakeCloudinary {
  uploads = new Map<string, string>(); // publicId -> format
  deleted: string[] = [];
  failNextUpload = false;
  private seq = 0;

  async uploadPrivate(_buffer: Buffer, folder: string) {
    if (this.failNextUpload) {
      this.failNextUpload = false;
      throw new Error('cloudinary down');
    }
    const publicId = `${folder}/fake-${++this.seq}`;
    this.uploads.set(publicId, 'png');
    return { publicId, format: 'png' };
  }

  signedReceiptUrl(publicId: string, format: string) {
    return `https://fake.cloudinary.test/${publicId}.${format}?signature=x`;
  }

  async deleteAuthenticated(publicId: string) {
    this.deleted.push(publicId);
  }

  deletedUrls: string[] = [];

  async uploadImage(_buffer: Buffer, folder: string) {
    if (this.failNextUpload) {
      this.failNextUpload = false;
      throw new Error('cloudinary down');
    }
    return `https://fake.cloudinary.test/image/upload/v1/${folder}/fake-${++this.seq}.jpg`;
  }

  async deleteByUrl(url: string) {
    this.deletedUrls.push(url);
  }
}

export const notificationsSpy = {
  enqueueRegistrationPaymentReviewed: jest.fn().mockResolvedValue(undefined),
  enqueueBookingCreated: jest.fn().mockResolvedValue(undefined),
  enqueueBookingStatusUpdated: jest.fn().mockResolvedValue(undefined),
  enqueueSubscriptionExpiring: jest.fn().mockResolvedValue(undefined),
};

export async function createRegistrationPaymentsApp(
  cloudinary: FakeCloudinary,
) {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CloudinaryService)
    .useValue(cloudinary)
    .overrideProvider(NotificationProducerService)
    .useValue(notificationsSpy)
    .compile();

  const app: INestApplication = moduleFixture.createNestApplication({
    bufferLogs: true,
  });
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
  return app;
}

export function bearer(
  app: INestApplication,
  user: { id: string; email: string; role: string },
) {
  const token = app
    .get(JwtService)
    .sign({ sub: user.id, email: user.email, role: user.role });
  return `Bearer ${token}`;
}

/** Smallest valid PNG (1×1). */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
