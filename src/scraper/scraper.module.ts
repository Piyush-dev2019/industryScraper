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
      },
    }),
    BullModule.registerQueue({
      name: 'scraping-queue',
      limiter: {
        max: 1, // Maximum number of jobs processed
        duration: 1000, // Per 1 second
      },
    }),
  ],
  controllers: [ScraperController],
  providers: [ScraperService, ScraperProcessor],
})
export class ScraperModule {}
