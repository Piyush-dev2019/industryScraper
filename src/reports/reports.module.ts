import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Report } from './entities/report.entity';
import { Ministry } from './entities/ministry.entity';
import { ReportMinistry } from './entities/report-ministry.entity';
import { PrivateBody } from './entities/private-body.entity';
import { ReportPrivateBody } from './entities/report-private-body.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Ministry, ReportMinistry, PrivateBody, ReportPrivateBody]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {} 