import { Customer } from 'src/customers/entities/customer.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { User } from 'src/users/entities/user.entity';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InvoiceStatus } from '../dto/create-invoice.dto';
import { InvoiceItem } from './invoice-item.entity/invoice-item.entity';
import { v4 as uuid } from 'uuid';

@Entity()
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  publicId: string;

  @BeforeInsert()
  generatePublicId() {
    this.publicId = `inv_${uuid()}`;
  }

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

  @ManyToOne(() => User, (user) => user.invoices)
  user: User;
}
