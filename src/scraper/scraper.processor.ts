import { Process, Processor, OnQueueError, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ScraperService } from './scraper.service';
import { governmentWebsitePrompt } from '../utils/prompts';
import * as fs from 'fs';
import * as path from 'path';

@Processor('scraping-queue')
export class ScraperProcessor {
  private readonly logger = new Logger(ScraperProcessor.name);
  private readonly failedJobsPath = path.join(process.cwd(), 'failed-jobs.json');

  constructor(private readonly scraperService: ScraperService) {
    // Initialize failed jobs file if it doesn't exist
    if (!fs.existsSync(this.failedJobsPath)) {
      fs.writeFileSync(this.failedJobsPath, JSON.stringify([], null, 2));
    }
  }

  @Process({
    name: 'scrape-government-website',
    concurrency: 1 // Process 1 jobs concurrently
  })
  async handleScraping(job: Job) {
    try {
      this.logger.log(`Processing job ${job.id} for ${job.data.organizationName}`);
      const { organizationName, url, folderName } = job.data;
      
      const result = await this.scraperService.main(
        governmentWebsitePrompt,
        organizationName,
        url,
        folderName,
      );

      this.logger.log(`Completed job ${job.id} for ${organizationName}`);
      return result;
    } catch (error) {
      // Log the error but don't throw it
      this.logger.error(`Error in job ${job.id} for ${job.data.organizationName}: ${error.message}`);
      
      // Save the failed job
      const failedJobs = JSON.parse(fs.readFileSync(this.failedJobsPath, 'utf8'));
      failedJobs.push({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        organizationName: job.data.organizationName,
        url: job.data.url,
        folderName: job.data.folderName,
        error: {
          message: error.message,
          stack: error.stack
        },
        jobData: job.data
      });
      fs.writeFileSync(this.failedJobsPath, JSON.stringify(failedJobs, null, 2));

      // Return a failure result instead of throwing
      return {
        success: false,
        error: error.message,
        organizationName: job.data.organizationName
      };
    }
  }

  @OnQueueError()
  handleError(error: Error) {
    this.logger.error(`Queue error: ${error.message}`);
    // Don't throw the error, just log it
  }

  @OnQueueFailed()
  async handleFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} failed for ${job.data.organizationName}: ${error.message}`,
    );
    
    try {
      // Initialize failed jobs array
      let failedJobs = [];
      
      // Read existing failed jobs if file exists and has content
      if (fs.existsSync(this.failedJobsPath)) {
        const fileContent = fs.readFileSync(this.failedJobsPath, 'utf8');
        if (fileContent.trim()) {
          try {
            failedJobs = JSON.parse(fileContent);
          } catch (parseError) {
            this.logger.error(`Error parsing failed jobs file: ${parseError.message}`);
            // If file is corrupted, start with empty array
            failedJobs = [];
          }
        }
      }

      // Add new failed job
      failedJobs.push({
        jobId: job.id,
        timestamp: new Date().toISOString(),
        organizationName: job.data.organizationName,
        url: job.data.url,
        folderName: job.data.folderName,
        error: {
          message: error.message,
          stack: error.stack
        },
        jobData: job.data
      });

      // Write back to file
      fs.writeFileSync(this.failedJobsPath, JSON.stringify(failedJobs, null, 2));
    } catch (writeError) {
      this.logger.error(`Error writing to failed jobs file: ${writeError.message}`);
    }
  }
} 