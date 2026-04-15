import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InvoiceStatus } from 'src/invoices/dto/create-invoice.dto';
import { Invoice } from 'src/invoices/entities/invoice.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
  ) {}

  async getDashboardStats() {
    const invoices = await this.invoiceRepo.find();

    const totalRevenue = invoices
      .filter((i) => i.status === InvoiceStatus.PAID)
      .reduce((sum, i) => sum + Number(i.totalAmount), 0);

    return {
      totalInvoices: invoices.length,
      totalRevenue,
      paid: invoices.filter((i) => i.status === InvoiceStatus.PAID).length,
      pending: invoices.filter((i) => i.status === InvoiceStatus.PENDING)
        .length,
      refunded: invoices.filter((i) => i.status === InvoiceStatus.REFUNDED)
        .length,
    };
  }
}
