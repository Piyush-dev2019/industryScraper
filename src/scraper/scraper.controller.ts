import { Controller, Post, Body } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
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
    @InjectQueue('scraping-queue') private scrapingQueue: Queue,
  ) {}

  @Post('particular-websites')
  async getTitles(@Body() body: ScraperDto) {
    return this.scraperService.main(governmentWebsitePrompt, body.organizationName, body.url, body.folderName, body.organizationType);
  }

  @Post('brokerage-website')
  async getBrokerageWebsite(@Body() body: ScraperDto) {
    return this.scraperService.main(brokerageWebsitePrompt, body.organizationName, body.url, body.folderName, body.organizationType);
  }

  @Post('batch-government-websites')
  async batchProcessGovernmentWebsites() {
    const sourcesPath = path.join(process.cwd(), 'particularSources.json');
    const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
    
    // Process in batches of 1
    const batchSize = 1;
    const results = [];
    
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);
      const batchPromises = batch.map(source => 
        this.scrapingQueue.add('scrape-government-website', {
          organizationName: source.organizationName,
          url: source.url,
          folderName: source.folderName,
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return {
      message: 'Batch processing started',
      totalJobs: results.length,
      jobIds: results.map(job => job.id),
    };
  }

  @Post('process-sources-sequential')
  async processSourcesSequential() {
    const sourcesPath = path.join(process.cwd(), 'particularSources.json');
    const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
    
    const results = [];
    const baseUrl = 'http://localhost:3000/scraper'; // Adjust this URL based on your setup
    
    for (const source of sources) {
      try {
        const response = await axios.post(`${baseUrl}/government-website`, {
          organizationName: source.organizationName,
          url: source.url,
          folderName: source.folderName
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