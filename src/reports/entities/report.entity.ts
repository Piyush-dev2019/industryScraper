import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { ReportMinistry } from './report-ministry.entity';
import { ReportPrivateBody } from './report-private-body.entity';

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  documentUrl: string;

  @Column()
  blobUrl: string;

  @Column({ type: 'int', nullable: true })
  year: number;

  @Column({
    type: 'enum',
    enum: ['processed', 'idle', 'failed'],
    default: 'idle',
  })
  status: 'processed' | 'idle' | 'failed';

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  @OneToMany(
    () => ReportMinistry,
    (reportMinistry) => reportMinistry.report,
    { cascade: ['insert', 'update'] },
  )
  reportMinistries: ReportMinistry[];

  @OneToMany(
    () => ReportPrivateBody,
    (reportPrivateBody) => reportPrivateBody.report,
    { cascade: ['insert', 'update'] },
  )
  reportPrivateBodies: ReportPrivateBody[];
}
