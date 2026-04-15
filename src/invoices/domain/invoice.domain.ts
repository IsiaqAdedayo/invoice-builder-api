import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '../dto/create-invoice.dto';
import { Invoice } from '../entities/invoice.entity';

export class InvoiceDomain {
  static assertCanModify(invoice: Invoice) {
    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'This invoice is locked and cannot be modified',
      );
    }
  }

  static assertCanRefund(invoice: Invoice) {
    if (invoice.status !== InvoiceStatus.PAID) {
      throw new BadRequestException('Only paid invoices can be refunded');
    }
  }

  static markRefunded(invoice: Invoice) {
    invoice.status = InvoiceStatus.REFUNDED;
    invoice.isLocked = true;
    return invoice;
  }

  static lock(invoice: Invoice) {
    invoice.isLocked = true;
    return invoice;
  }
}
