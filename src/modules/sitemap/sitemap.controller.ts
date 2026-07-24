import { Controller, Get, Header, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SitemapService } from './sitemap.service';

@ApiExcludeController()
@Controller()
@SkipThrottle()
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  async getSitemap(): Promise<string> {
    return this.sitemapService.buildXml();
  }
}
