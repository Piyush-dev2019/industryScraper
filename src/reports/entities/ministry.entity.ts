import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { ReportMinistry } from './report-ministry.entity';

@Entity({ schema: 'sahil_schema', name: 'ministry' })
export class Ministry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  url: string;

  @OneToMany(
    () => ReportMinistry,
    (reportMinistry) => reportMinistry.ministry,
    { cascade: ['insert', 'update'] },
  )
  reportMinistries: ReportMinistry[];
}
