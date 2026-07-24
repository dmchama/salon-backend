import { Injectable } from '@nestjs/common';
import { SalonStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const STATIC_PATHS = ['/', '/salons', '/pricing'];

@Injectable()
export class SitemapService {
  constructor(private readonly prisma: PrismaService) {}

  private get siteUrl(): string {
    return process.env.FRONTEND_URL ?? 'https://saloonbooking.lk';
  }

  async buildXml(): Promise<string> {
    const salons = await this.prisma.salon.findMany({
      where: { status: SalonStatus.PUBLISHED },
      select: { slug: true, updatedAt: true },
    });

    const urls = [
      ...STATIC_PATHS.map((path) => ({ loc: `${this.siteUrl}${path}`, lastmod: undefined as string | undefined })),
      ...salons.map((s) => ({
        loc: `${this.siteUrl}/salon/${s.slug}`,
        lastmod: s.updatedAt.toISOString().slice(0, 10),
      })),
    ];

    const entries = urls
      .map(
        (u) =>
          `  <url>\n    <loc>${escapeXml(u.loc)}</loc>${
            u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''
          }\n  </url>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      default:
        return '&quot;';
    }
  });
}
