import { IsString, IsNumber } from 'class-validator';

export class CreateReportDto {
  @IsString()
  documentName: string;

  @IsString()
  documentUrl: string;

  @IsString()
  blobUrl: string;

  @IsNumber()
  year: number;

  @IsString()
  status: 'processed' | 'idle' | 'failed';

  @IsString()
  ministryName: string;

  @IsString()
  ministryUrl: string;

  @IsString({ each: true })
  exactSourceUrl: string[];
} 