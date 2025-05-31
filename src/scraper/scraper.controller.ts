import { Controller, Post, Body } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { governmentWebsitePrompt, brokerageWebsitePrompt } from '../utils/prompts';
import { ScraperDto } from './dto/scraper.dto';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

@Controller('scraper')
export class ScraperController {
  constructor(
    private readonly scraperService: ScraperService,
  ) {}

  @Post('particular-websites')
  async getTitles(@Body() body: ScraperDto) {
    return this.scraperService.main(governmentWebsitePrompt, body.organizationName, body.url, body.folderName, body.organizationType);
  }

  @Post('brokerage-website')
  async getBrokerageWebsite(@Body() body: ScraperDto) {
    return this.scraperService.main(brokerageWebsitePrompt, body.organizationName, body.url, body.folderName, body.organizationType);
  }

  @Post('process-sources-sequential')
  async processSourcesSequential() {
    const sourcesPath = path.join(process.cwd(), 'particularSources.json');
    const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
    
    const results = [];
    const baseUrl = 'http://localhost:3000/scraper'; // Adjust this URL based on your setup
    
    for (const source of sources) {
      try {
        const response = await axios.post(`${baseUrl}/particular-websites`, {
          organizationName: source.organizationName,
          url: source.url,
          folderName: source.folderName,
          organizationType: source.organizationType
        });
        
        results.push({
          organizationName: source.organizationName,
          status: 'success',
          data: response.data
        });
      } catch (error) {
        results.push({
          organizationName: source.organizationName,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return {
      message: 'Processing completed',
      totalProcessed: sources.length,
      results
    };
  }
}