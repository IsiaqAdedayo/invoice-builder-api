import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  entity: string; // e.g. "Invoice"

  @Column()
  entityId: number;

  @Column()
  action: string; // CREATE | UPDATE | PAYMENT | REFUND | LOCK

  @Column({ type: 'json', nullable: true })
  before: any;

  @Column({ type: 'json', nullable: true })
  after: any;

  @Column({ nullable: true })
  performedBy: number; // userId later from JWT

  @CreateDateColumn()
  createdAt: Date;
}
