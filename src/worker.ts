import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  await app.init();
  Logger.log('Notification worker started (BullMQ processors + schedulers)', 'Worker');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
