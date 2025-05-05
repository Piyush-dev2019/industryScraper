import { IsString, IsUrl, IsNotEmpty } from 'class-validator';

export class ScraperDto {
  @IsString()
  @IsNotEmpty()
  organizationName: string;

  @IsString()
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  folderName: string;
} 