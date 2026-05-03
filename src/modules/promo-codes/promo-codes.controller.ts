import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PromoCodesService } from './promo-codes.service';

@ApiTags('promo-codes')
@Controller({ path: 'promo-codes', version: '1' })
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Public()
  @Get('validate')
  async validate(
    @Query('code') code: string,
    @Query('salonId') salonId: string,
    @Query('serviceId') serviceId?: string,
  ) {
    const promo = await this.promoCodesService.validate(code, salonId, serviceId);
    return {
      valid: true,
      discountPct: promo.discountPct,
      discountScope: promo.discountScope,
      serviceIds: promo.serviceIds as string[] | null,
      validTo: promo.validTo,
    };
  }
}
