import { IsString, IsNumber, IsOptional } from 'class-validator';

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
  @IsOptional()
  ministryName?: string;

  @IsString()
  @IsOptional()
  ministryUrl?: string;

  @IsString()
  @IsOptional()
  privateBodyName?: string;

  @IsString()
  @IsOptional()
  privateBodyUrl?: string;

  @IsString({ each: true })
  exactSourceUrl: string[];
} 