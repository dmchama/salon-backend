import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  CurrentUser,
  JwtPayloadUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReceiptUploadInterceptor } from './receipt-upload.interceptor';
import { RegistrationPaymentsService } from './registration-payments.service';

/** Owner side of the registration payment (spec 002). Always scoped to the caller's own account. */
@ApiTags('registration-payments')
@ApiBearerAuth('access-token')
@Controller({ path: 'registration-payments', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SALON_ADMIN)
export class RegistrationPaymentsController {
  constructor(
    private readonly registrationPayments: RegistrationPaymentsService,
  ) {}

  @Get('me')
  getMine(@CurrentUser() user: JwtPayloadUser) {
    return this.registrationPayments.getMine(user.sub);
  }

  @Post('me/receipt')
  @UseInterceptors(ReceiptUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['receipt'],
      properties: { receipt: { type: 'string', format: 'binary' } },
    },
  })
  reupload(
    @CurrentUser() user: JwtPayloadUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.registrationPayments.reupload(user.sub, file);
  }
}
