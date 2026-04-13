import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get('salons')
  searchSalons(@Query('q') q?: string, @Query('city') city?: string) {
    return this.searchService.searchSalons(q, city);
  }
}
