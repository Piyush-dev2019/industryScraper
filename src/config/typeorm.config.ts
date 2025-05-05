import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { Report } from '../reports/entities/report.entity';
import { Ministry } from '../reports/entities/ministry.entity';
import { ReportMinistry } from '../reports/entities/report-ministry.entity';

config(); // Load environment variables

export const typeOrmConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'postgres',
  port: parseInt(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgress',
  database: process.env.DATABASE_NAME || 'postgres',
  entities: [Report, Ministry, ReportMinistry],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
};

export default new DataSource(typeOrmConfig); 