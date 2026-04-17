import { Invoice } from 'src/invoices/entities/invoice.entity';
import {
  BeforeInsert,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { v4 as uuid } from 'uuid';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number; // internal

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: 'user' })
  role: string;

  @Column({ unique: true, nullable: true })
  publicId: string; // external

  @OneToMany(() => Invoice, (invoice) => invoice.customer)
  invoices: Invoice[];

  @BeforeInsert()
  generatePublicId() {
    this.publicId = `usr_${uuid()}`;
  }
}
