import { Controller, Post, Body } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { governmentWebsitePrompt, brokerageWebsitePrompt } from '../utils/prompts';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('government-website')
  async getTitles(@Body() body: { organizationName: string , url: string, folderName: string }) {
    return this.scraperService.main(governmentWebsitePrompt, body.organizationName, body.url, body.folderName);
  }

  @Post('brokerage-website')
  async getBrokerageWebsite(@Body() body: { organizationName: string , url: string, folderName: string }) {
    return this.scraperService.main(brokerageWebsitePrompt, body.organizationName, body.url, body.folderName);
  }

  // @Post('upload')
  // async uploadFromUrlsJson(@Body() body: { organizationName: string }) {
  //   return this.scraperService.uploadFromUrlsJson(body.organizationName);
  // }
}