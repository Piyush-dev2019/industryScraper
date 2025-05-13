import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { ScraperProcessor } from './scraper.processor';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    ReportsModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: 6379,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
        timeout: 300000, // 5 minutes timeout
        jobId: undefined, // Let Bull generate job IDs
      },
    }),
    BullModule.registerQueue({
      name: 'scraping-queue',
      limiter: {
        max: 1, // Maximum number of jobs processed
        duration: 1000, // Per 1 second
      },
      settings: {
        stalledInterval: 30000, // Check for stalled jobs every 30 seconds
        maxStalledCount: 2, // Number of times a job can be marked as stalled before failing
        lockDuration: 300000, // Lock duration of 5 minutes
      },
    }),
  ],
  controllers: [ScraperController],
  providers: [ScraperService, ScraperProcessor],
})
export class ScraperModule {}
