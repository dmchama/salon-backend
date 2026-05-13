import { Body, Controller, Get, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SalonOwnersService } from './salon-owners.service';

const RECEIPTS_DIR = './uploads/receipts';
mkdirSync(RECEIPTS_DIR, { recursive: true });

@ApiTags('salon-owners')
@ApiBearerAuth('access-token')
@Controller({ path: 'salon-owners', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SALON_ADMIN)
export class SalonOwnersController {
  constructor(private readonly salonOwnersService: SalonOwnersService) {}

  @Get('me/dashboard')
  dashboard(@CurrentUser() user: JwtPayloadUser) {
    return this.salonOwnersService.dashboard(user.sub, user.role as Role);
  }

  @Get('me/insights')
  insights(
    @CurrentUser() user: JwtPayloadUser,
    @Query('salonId') salonId: string,
  ) {
    return this.salonOwnersService.getInsights(user.sub, salonId, user.role as Role);
  }

  @Get('campaign/customers')
  getOwnerCampaignCustomers(
    @CurrentUser() user: JwtPayloadUser,
    @Query('salonId') salonId: string,
    @Query('segment') segment: string,
  ) {
    return this.salonOwnersService.getOwnerCampaignCustomers(user.sub, salonId, segment ?? 'all');
  }

  @Get('campaign/services')
  getOwnerCampaignServices(
    @CurrentUser() user: JwtPayloadUser,
    @Query('salonId') salonId: string,
  ) {
    return this.salonOwnersService.getOwnerCampaignServices(user.sub, salonId);
  }

  @Get('campaign/sms-price')
  getSmsCampaignPrice() {
    return this.salonOwnersService.getSmsCampaignPrice();
  }

  @Post('campaign/request')
  @UseInterceptors(FileInterceptor('receipt', {
    storage: diskStorage({
      destination: RECEIPTS_DIR,
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      cb(null, allowed.includes(file.mimetype));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  submitCampaignRequest(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const receiptUrl = file ? `/uploads/receipts/${file.filename}` : undefined;
    return this.salonOwnersService.submitCampaignRequest(user.sub, {
      salonId: body.salonId,
      campaignName: body.campaignName,
      segment: body.segment,
      discountPct: Number(body.discountPct),
      discountScope: body.discountScope,
      serviceIds: body.serviceIds ? JSON.parse(body.serviceIds) : [],
      validFrom: body.validFrom || undefined,
      validTo: body.validTo || undefined,
      message: body.message,
      scheduledAt: body.scheduledAt || undefined,
      recipientCount: Number(body.recipientCount) || 0,
    }, receiptUrl);
  }

  @Post('campaign/sms')
  sendOwnerSmsCampaign(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: any,
  ) {
    return this.salonOwnersService.sendOwnerSmsCampaign(user.sub, body);
  }

  @Get('campaign/history')
  getOwnerCampaignHistory(
    @CurrentUser() user: JwtPayloadUser,
    @Query('salonId') salonId: string,
  ) {
    return this.salonOwnersService.getOwnerCampaignHistory(user.sub, salonId);
  }
}
