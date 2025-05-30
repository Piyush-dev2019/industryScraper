import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScraperModule } from './scraper/scraper.module';
import { ReportsModule } from './reports/reports.module';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './reports/entities/report.entity';
import { Ministry } from './reports/entities/ministry.entity';
import { ReportMinistry } from './reports/entities/report-ministry.entity';
import { PrivateBody } from './reports/entities/private-body.entity';
import { ReportPrivateBody } from './reports/entities/report-private-body.entity';

@Module({
  imports: [
    ScraperModule,
    ReportsModule,
    AuthModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'postgres',
      port: parseInt(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgress',
      database: process.env.DATABASE_NAME || 'postgres',
      entities: [Report, Ministry, ReportMinistry, PrivateBody, ReportPrivateBody],
      synchronize: false,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
