import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Report } from './report.entity';
import { PrivateBody } from './private-body.entity';

@Entity({ schema: 'sahil_schema', name: 'report_private_body' })
export class ReportPrivateBody {
  @PrimaryGeneratedColumn()
  id: number;
  
  @Column('text', { array: true, nullable: true })
  exactSourceUrl: string[];

  @ManyToOne(
    () => Report,
    (report) => report.reportPrivateBodies,
    { onDelete: 'CASCADE', nullable: false },
  )
  @JoinColumn({ name: 'reportId' })
  report: Report;

  @Column()
  reportId: number;

  @ManyToOne(
    () => PrivateBody,
    (privateBody) => privateBody.reportPrivateBodies,
    { onDelete: 'RESTRICT', nullable: false },
  )
  @JoinColumn({ name: 'privateBodyId' })
  privateBody: PrivateBody;

  @Column()
  privateBodyId: number;
} 