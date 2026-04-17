import { Invoice } from 'src/invoices/entities/invoice.entity';
import {
  BeforeInsert,
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { v4 as uuid } from 'uuid';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  publicId: string;

  @BeforeInsert()
  generatePublicId() {
    this.publicId = `pay_${uuid()}`;
  }

  @Column()
  amount: number;

  @Column({ default: 'success' })
  status: 'success' | 'failed' | 'refunded';

  @Column({ nullable: true })
  type: 'payment' | 'refund';

  @ManyToOne(() => Invoice, (invoice) => invoice.payments)
  invoice: Invoice;
}
