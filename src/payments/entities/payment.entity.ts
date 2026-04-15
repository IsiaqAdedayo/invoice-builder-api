import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Invoice } from 'src/invoices/entities/invoice.entity';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  amount: number;

  @Column({ default: 'success' })
  status: 'success' | 'failed';

  @Column()
  type: 'payment' | 'refund';

  @ManyToOne(() => Invoice, (invoice) => invoice.payments)
  invoice: Invoice;
}
