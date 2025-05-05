import { Controller, Post, Body } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { governmentWebsitePrompt, brokerageWebsitePrompt } from '../utils/prompts';
import { ScraperDto } from './dto/scraper.dto';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('government-website')
  async getTitles(@Body() body: ScraperDto) {
    return this.scraperService.main(governmentWebsitePrompt, body.organizationName, body.url, body.folderName);
  }

  @Post('brokerage-website')
  async getBrokerageWebsite(@Body() body: ScraperDto) {
    return this.scraperService.main(brokerageWebsitePrompt, body.organizationName, body.url, body.folderName);
  }
}