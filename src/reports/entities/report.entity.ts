import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Ministry } from './ministry.entity';

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

  @Column()
  year: number;

  @Column({
    type: 'enum',
    enum: ['processed', 'notProcessed', 'failed'],
    default: 'notProcessed'
  })
  status: 'processed' | 'notProcessed' | 'failed';

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

//   @OneToMany(() => ReportMinistry, reportMinistry => reportMinistry.reportId)
//   reportMinistries: ReportMinistry[];

  @Column()
  ministryId: number;

  @ManyToOne(() => Ministry, ministry => ministry.reports)
  @JoinColumn({ name: 'ministry_id' })
  ministry: Ministry;
} 