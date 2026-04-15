import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from 'src/customers/entities/customer.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

import { PdfModule } from 'src/pdf/pdf.module';
import { Payment } from 'src/payments/entities/payment.entity';
import { AuditModule } from 'src/audit/audit.module';
import { MailModule } from 'src/mail/mail.module';
import { AnalyticsModule } from 'src/analytics/analytics.module';
import { InvoiceItem } from './entities/invoice-item.entity/invoice-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Customer, Payment]),
    PdfModule, // ✅ ADD THIS
    AuditModule,
    MailModule,
    AnalyticsModule,
  ],
  providers: [InvoicesService],
  controllers: [InvoicesController],
})
export class InvoicesModule {}
