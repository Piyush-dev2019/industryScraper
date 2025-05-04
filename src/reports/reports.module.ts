import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Report } from './entities/report.entity';
import { Ministry } from './entities/ministry.entity';
import { ReportMinistry } from './entities/report-ministry.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Ministry, ReportMinistry]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {} 