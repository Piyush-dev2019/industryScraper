import { IsString, IsNumber } from 'class-validator';

export class CreateReportDto {
  @IsString()
  reportName: string;

  @IsString()
  documentUrl: string;

  @IsString()
  blobUrl: string;

  @IsNumber()
  year: number;

  @IsString()
  status: 'processed' | 'notProcessed' | 'failed';

  @IsString()
  ministryName: string;

  @IsString()
  ministryUrl: string;

  @IsString()
  reportSourceUrl: string;
  
} 