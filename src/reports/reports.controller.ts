import { Controller, Post, Body } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async createReportEntry(@Body() createReportDto: CreateReportDto) {
    return this.reportsService.makeReportEntry(createReportDto);
  }
} 