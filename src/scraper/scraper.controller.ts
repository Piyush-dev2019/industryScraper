
import { Controller, Get } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { governmentWebsitePrompt, brokerageWebsitePrompt } from '../utils/prompts';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Get('government-website')
  async getTitles() {
    return this.scraperService.main(governmentWebsitePrompt);
  }


@Get('brokerage-website')
async getBrokerageWebsite() {
  return this.scraperService.main(brokerageWebsitePrompt);
}
}