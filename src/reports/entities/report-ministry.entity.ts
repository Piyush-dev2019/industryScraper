import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Report } from './report.entity';
import { Ministry } from './ministry.entity';

@Entity({ schema: 'sahil_schema', name: 'report_ministry' })
export class ReportMinistry {
  @PrimaryGeneratedColumn()
  id: number;
  
  @Column('text', { array: true, nullable: true })
  exactSourceUrl: string[];

  @ManyToOne(
    () => Report,
    (report) => report.reportMinistries,
    { onDelete: 'CASCADE', nullable: false },
  )
  @JoinColumn({ name: 'reportId' })
  report: Report;

  @Column()
  reportId: number;

  @ManyToOne(
    () => Ministry,
    (ministry) => ministry.reportMinistries,
    { onDelete: 'RESTRICT', nullable: false },
  )
  @JoinColumn({ name: 'ministryId' })
  ministry: Ministry;

  @Column()
  ministryId: number;
}
