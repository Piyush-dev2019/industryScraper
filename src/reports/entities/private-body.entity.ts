import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { ReportPrivateBody } from './report-private-body.entity';

@Entity({ schema: 'sahil_schema', name: 'private_body' })
export class PrivateBody {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  url: string;

  @OneToMany(
    () => ReportPrivateBody,
    (reportPrivateBody) => reportPrivateBody.privateBody,
    { cascade: ['insert', 'update'] },
  )
  reportPrivateBodies: ReportPrivateBody[];
} 