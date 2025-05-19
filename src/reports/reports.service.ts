// reports.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { Ministry } from './entities/ministry.entity';
import { ReportMinistry } from './entities/report-ministry.entity';
import { PrivateBody } from './entities/private-body.entity';
import { ReportPrivateBody } from './entities/report-private-body.entity';
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

    // @InjectRepository(PrivateBody)
    // private readonly privateBodyRepo: Repository<PrivateBody>,

    // @InjectRepository(ReportPrivateBody)
    // private readonly reportPrivateBodyRepo: Repository<ReportPrivateBody>,
  ) {}

  async makeReportEntryMinistryTable(dto: CreateReportDto): Promise<Report> {
    return await this.reportRepo.manager.transaction(async manager => {
      // 1) find or create ministry
      let ministry = await manager.findOne(Ministry, {
        where: { url: dto.ministryUrl },
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
        name: dto.documentName,
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

  async makeReportEntryPrivateBodyTable(dto: CreateReportDto): Promise<Report> {
    return await this.reportRepo.manager.transaction(async manager => {
      // 1) find or create private body
      let privateBody = await manager.findOne(PrivateBody, {
        where: { url: dto.privateBodyUrl },
      });
      if (!privateBody) {
        privateBody = manager.create(PrivateBody, {
          name: dto.privateBodyName,
          url: dto.privateBodyUrl,
        });
        privateBody = await manager.save(privateBody);
      }

      // 2) create report
      const report = manager.create(Report, {
        name: dto.documentName,
        documentUrl: dto.documentUrl,
        blobUrl: dto.blobUrl,
        year: dto.year,
        status: dto.status,
      });
      const savedReport = await manager.save(report);

      // 3) create join row
      const mapping = manager.create(ReportPrivateBody, {
        reportId: savedReport.id,
        privateBodyId: privateBody.id,
        exactSourceUrl: dto.exactSourceUrl,
      });
      await manager.save(mapping);

      return savedReport;
    });
  }
}
