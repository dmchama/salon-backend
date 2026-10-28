import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../common/cloudinary/cloudinary.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminRegistrationPaymentsController } from './admin-registration-payments.controller';
import { RegistrationPaymentsController } from './registration-payments.controller';
import { RegistrationPaymentsService } from './registration-payments.service';

@Module({
  imports: [CloudinaryModule, NotificationsModule],
  controllers: [
    RegistrationPaymentsController,
    AdminRegistrationPaymentsController,
  ],
  providers: [RegistrationPaymentsService],
  exports: [RegistrationPaymentsService],
})
export class RegistrationPaymentsModule {}
