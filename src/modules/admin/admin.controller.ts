import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { OverageService } from './overage.service';

@ApiTags('admin')
@Controller({ path: 'website-settings', version: '1' })
export class PublicWebsiteController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Get()
  getPublicWebsiteSettings() {
    return this.adminService.getWebsiteSettings();
  }
}

@ApiBearerAuth('access-token')
@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly overageService: OverageService,
  ) {}

  @Get('stats')
  stats(@CurrentUser() user: JwtPayloadUser) {
    return this.adminService.stats(user.role as Role);
  }

  @Get('owners')
  listOwners() {
    return this.adminService.listOwners();
  }

  @Get('website')
  getWebsiteSettings() {
    return this.adminService.getWebsiteSettings();
  }

  @Patch('website/hero-slides')
  saveHeroSlides(@Body() body: { slides: { id: string; mediaType: string; mediaUrl: string; title: string; subtitle: string; buttonText: string }[] }) {
    return this.adminService.saveHeroSlides(body.slides as any);
  }

  @Patch('website/footer')
  saveFooter(@Body() body: { footerText: string; supportEmail: string }) {
    return this.adminService.saveFooter(body);
  }

  @Patch('website/seo')
  saveSeo(@Body() body: { metaTitle: string; metaDescription: string }) {
    return this.adminService.saveSeo(body);
  }

  @Get('salons')
  listSalons() {
    return this.adminService.listSalons();
  }

  @Patch('salons/:id/publish')
  publishSalon(@Param('id') id: string) {
    return this.adminService.publishSalon(id);
  }

  @Patch('salons/:id/suspend')
  suspendSalon(@Param('id') id: string) {
    return this.adminService.suspendSalon(id);
  }

  @Patch('salons/:id/draft')
  draftSalon(@Param('id') id: string) {
    return this.adminService.draftSalon(id);
  }

  @Patch('owners/:id/approve')
  approveOwner(@Param('id') id: string) {
    return this.adminService.approveOwner(id);
  }

  @Patch('owners/:id/suspend')
  suspendOwner(@Param('id') id: string) {
    return this.adminService.suspendOwner(id);
  }

  @Patch('owners/:id/activate')
  activateOwner(@Param('id') id: string) {
    return this.adminService.activateOwner(id);
  }

  @Get('campaign/customers')
  getCampaignCustomers(@Query('segment') segment: string) {
    return this.adminService.getCampaignCustomers(segment ?? 'all');
  }

  @Get('campaign/services')
  getCampaignServices() {
    return this.adminService.getCampaignServices();
  }

  @Post('campaign/sms')
  sendSmsCampaign(@Body() body: any) {
    return this.adminService.sendSmsCampaign(body);
  }

  @Get('sms-price')
  getSmsCampaignPrice() {
    return this.adminService.getSmsCampaignPrice();
  }

  @Patch('sms-price')
  setSmsCampaignPrice(@Body() body: { priceCents: number }) {
    return this.adminService.setSmsCampaignPrice(body.priceCents);
  }

  @Get('promo-codes')
  listPromoCodes() {
    return this.adminService.listPromoCodes();
  }

  @Get('campaign-requests')
  listCampaignRequests() {
    return this.adminService.listCampaignRequests();
  }

  @Patch('campaign-requests/:id/approve')
  approveCampaignRequest(@Param('id') id: string) {
    return this.adminService.approveCampaignRequest(id);
  }

  @Patch('campaign-requests/:id/reject')
  rejectCampaignRequest(@Param('id') id: string, @Body() body: { note?: string }) {
    return this.adminService.rejectCampaignRequest(id, body.note ?? '');
  }

  // ── Overage Price ────────────────────────────────────────────────────────

  @Get('overage-price')
  getOveragePrice() {
    return this.overageService.getOveragePrice();
  }

  @Patch('overage-price')
  setOveragePrice(@Body() body: { priceCents: number }) {
    return this.overageService.setOveragePrice(body.priceCents);
  }

  // ── Overage Invoices ─────────────────────────────────────────────────────

  @Post('overage-invoices/generate')
  generateInvoices(@Body() body: { year: number; month: number }) {
    return this.overageService.generateInvoices(body.year, body.month);
  }

  @Get('overage-invoices')
  listInvoices(@Query('status') status?: string) {
    return this.overageService.listInvoices(status);
  }

  @Patch('overage-invoices/:id/send')
  sendInvoice(@Param('id') id: string) {
    return this.overageService.sendInvoice(id);
  }

  @Patch('overage-invoices/:id/paid')
  markInvoicePaid(@Param('id') id: string) {
    return this.overageService.markPaid(id);
  }

  @Patch('overage-invoices/:id/cancel')
  cancelInvoice(@Param('id') id: string) {
    return this.overageService.cancelInvoice(id);
  }
}
