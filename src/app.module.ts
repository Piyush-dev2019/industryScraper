import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScraperModule } from './scraper/scraper.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './reports/entities/report.entity';
import { Ministry } from './reports/entities/ministry.entity';
import { ReportMinistry } from './reports/entities/report-ministry.entity';

@Module({
  imports: [
    ScraperModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'postgres',
      port: parseInt(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgress',
      database: process.env.DATABASE_NAME || 'postgres',
      entities: [Report, Ministry, ReportMinistry],
      synchronize: false,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
