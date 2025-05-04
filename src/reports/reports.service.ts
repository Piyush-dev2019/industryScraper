// reports.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { Ministry } from './entities/ministry.entity';
import { ReportMinistry } from './entities/report-ministry.entity';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,

    // @InjectRepository(Ministry)
    // private readonly ministryRepo: Repository<Ministry>,

    // @InjectRepository(ReportMinistry)
    // private readonly mapRepo: Repository<ReportMinistry>,
  ) {}

  async makeReportEntry(dto: CreateReportDto): Promise<Report> {
    return await this.reportRepo.manager.transaction(async manager => {
      // 1) find or create ministry
      let ministry = await manager.findOne(Ministry, {
        where: { name: dto.ministryName, url: dto.ministryUrl },
      });
      if (!ministry) {
        ministry = manager.create(Ministry, {
          name: dto.ministryName,
          url: dto.ministryUrl,
        });
        ministry = await manager.save(ministry);
      }

      // 2) create report
      const report = manager.create(Report, {
        name: dto.reportName,
        documentUrl: dto.documentUrl,
        blobUrl: dto.blobUrl,
        year: dto.year,
        status: dto.status,
      });
      const savedReport = await manager.save(report);

      // 3) create join row
      const mapping = manager.create(ReportMinistry, {
        reportId: savedReport.id,       // FK filled by @ManyToOne + @JoinColumn
        ministryId: ministry.id,                  // same here
        exactSourceUrl: dto.exactSourceUrl,
      });
      await manager.save(mapping);

      return savedReport;
    });
  }
}
