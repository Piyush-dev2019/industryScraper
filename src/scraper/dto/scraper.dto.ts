import { IsString, IsUrl, IsNotEmpty, IsEnum } from 'class-validator';

export enum OrganizationType {
  GOVERNMENT = 'government',
  PRIVATE = 'private',
}

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

  @IsEnum(OrganizationType)
  @IsNotEmpty()
  organizationType: OrganizationType;
} 