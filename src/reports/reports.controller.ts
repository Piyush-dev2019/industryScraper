import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async createReportEntry(@Body() createReportDto: CreateReportDto) {
    return this.reportsService.makeReportEntryMinistryTable(createReportDto);
  }

  @Get('government')
  async getGovernmentReports(
    @Query('year') year?: string,
    @Query('status') status?: 'processed' | 'idle' | 'failed'
  ) {
    if (year) {
      return this.reportsService.getGovernmentReportsByYear(parseInt(year));
    }
    if (status) {
      return this.reportsService.getGovernmentReportsByStatus(status);
    }
    return this.reportsService.getGovernmentReports();
  }

  @Get('private')
  async getPrivateReports(
    @Query('year') year?: string,
    @Query('status') status?: 'processed' | 'idle' | 'failed'
  ) {
    if (year) {
      return this.reportsService.getPrivateReportsByYear(parseInt(year));
    }
    if (status) {
      return this.reportsService.getPrivateReportsByStatus(status);
    }
    return this.reportsService.getPrivateReports();
  }
} 