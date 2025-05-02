import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { Ministry } from './entities/ministry.entity';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Ministry)
    private readonly ministryRepository: Repository<Ministry>
  ) {}

  async createReport(reportData: Partial<Report>): Promise<Report> {
    const report = this.reportRepository.create(reportData);
    return this.reportRepository.save(report);
  }

  async createMinistry(ministryData: Partial<Ministry>): Promise<Ministry> {
    const ministry = this.ministryRepository.create(ministryData);
    return this.ministryRepository.save(ministry);
  }

  async createReportWithMinistry(createReportDto: CreateReportDto) {
    // 1. Create or find ministry
    let ministry = await this.ministryRepository.findOne({ 
      where: { name: createReportDto.ministryName } 
    });
    
    if (!ministry) {
      ministry = await this.ministryRepository.save({
        name: createReportDto.ministryName,
        url: createReportDto.ministryUrl,
      });
    }

    // 2. Create report
    const expReport = new Report();
    expReport.name = createReportDto.reportName;
    expReport.documentUrl = createReportDto.documentUrl;
    expReport.blobUrl = createReportDto.blobUrl;
    expReport.year = createReportDto.year;
    expReport.status = 'notProcessed';
    expReport.ministryId = ministry.id;
    const report = await this.reportRepository.save(expReport);



    return report;
  }
} 