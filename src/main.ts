import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import configuration from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(join(uploadsDir, 'receipts'), { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
  app.useLogger(app.get(PinoLogger));

  const config = configuration();
  app.enableCors({
    origin: config.corsOrigins?.length ? config.corsOrigins : true,
    credentials: true,
  });

  app.setGlobalPrefix(config.apiPrefix, { exclude: ['sitemap.xml'] });
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Salon Platform API')
    .setDescription('Modular monolith — salon profiles, bookings, subscriptions, notifications')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${config.apiPrefix}/docs`, app, document);

  await app.listen(config.port);
  Logger.log(`Listening ${await app.getUrl()}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
