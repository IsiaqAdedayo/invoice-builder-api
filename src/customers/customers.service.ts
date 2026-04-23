import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InvoiceStatus } from 'src/invoices/dto/create-invoice.dto';
import { Invoice } from 'src/invoices/entities/invoice.entity';
import { Repository } from 'typeorm';
import { format, subDays } from 'date-fns';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
  ) {}

  create(createCustomerDto: CreateCustomerDto) {
    const customer = this.customerRepo.create(createCustomerDto);
    return this.customerRepo.save(customer);
  }

  /** Enriched list with totalSpent, invoiceCount, paidRate, status, joinedFmt */
  async findAll() {
    const customers = await this.customerRepo.find({
      relations: ['invoices'],
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    const cutoff90 = subDays(now, 90);

    return customers.map((c) => {
      const invoices = c.invoices ?? [];

      const paid = invoices.filter((i) => i.status === InvoiceStatus.PAID);
      const pending = invoices.filter(
        (i) => i.status === InvoiceStatus.PENDING,
      );

      const totalSpent = paid.reduce(
        (sum, i) => sum + Number(i.totalAmount),
        0,
      );
      const invoiceCount = invoices.length;
      const paidRate =
        invoiceCount === 0
          ? 0
          : parseFloat(((paid.length / invoiceCount) * 100).toFixed(1));

      // Status derivation
      const hasOverdue = pending.some(
        (i) => i.dueDate && new Date(i.dueDate) < now,
      );
      const hasRecentActivity = invoices.some(
        (i) => new Date(i.createdAt) >= cutoff90,
      );
      let status: 'active' | 'inactive' | 'overdue' = 'active';
      if (hasOverdue) {
        status = 'overdue';
      } else if (invoiceCount > 0 && !hasRecentActivity) {
        status = 'inactive';
      }

      return {
        publicId: c.publicId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        totalSpent,
        totalSpentFmt: `₦${totalSpent.toLocaleString('en-NG')}`,
        invoiceCount,
        paidRate,
        status,
        joinedFmt: c.createdAt
          ? format(new Date(c.createdAt), 'dd MMM yyyy')
          : '—',
        createdAt: c.createdAt,
      };
    });
  }

  findOne(publicId: string) {
    return this.customerRepo.findOne({ where: { publicId } });
  }

  /** GET /customers/:id/invoices — customer-scoped invoice list */
  async findCustomerInvoices(customerId: string) {
    const invoices = await this.invoiceRepo.find({
      where: { customer: { publicId: customerId } },
      relations: ['customer', 'items'],
      order: { createdAt: 'DESC' },
    });

    return invoices.map((inv) => {
      const suffix = inv.publicId?.slice(-6).toUpperCase() ?? '??????';
      return {
        publicId: inv.publicId,
        id: `INV-${suffix}`,
        customerName: inv.customer?.name ?? '—',
        customerEmail: inv.customer?.email ?? '—',
        totalAmount: Number(inv.totalAmount),
        amountFmt: `₦${Number(inv.totalAmount).toLocaleString('en-NG')}`,
        status: inv.status,
        issuedFmt: inv.createdAt
          ? format(new Date(inv.createdAt), 'dd MMM yyyy')
          : '—',
        dueFmt: inv.dueDate
          ? format(new Date(inv.dueDate), 'dd MMM yyyy')
          : '—',
        dueDate: inv.dueDate ?? null,
        createdAt: inv.createdAt,
      };
    });
  }
}
