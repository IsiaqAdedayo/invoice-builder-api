import { Customer } from 'src/customers/entities/customer.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { InvoiceItem } from './invoice-item.entity/invoice-item.entity';
import { InvoiceStatus } from '../dto/create-invoice.dto';
import { Payment } from 'src/payments/entities/payment.entity';

@Entity()
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'decimal',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalAmount: number;

  @Column({ default: 'draft' })
  status: InvoiceStatus;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Customer, (customer) => customer.invoices, {
    onDelete: 'CASCADE',
  })
  customer: Customer;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, {
    cascade: true,
  })
  items: InvoiceItem[];

  @Column({ type: 'json', nullable: true })
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
  };

  @Column({ type: 'json', nullable: true })
  tax?: {
    rate: number;
  };

  @Column({ default: false })
  isLocked: boolean;

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments: Payment[];
}
