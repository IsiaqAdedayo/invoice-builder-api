import { ForbiddenException } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { Invoice } from 'src/invoices/entities/invoice.entity';

export class RbacDomain {
  static assertCanAccessInvoice(user: User, invoice: Invoice) {
    if (user.role === 'admin') return;

    if (user.role === 'accountant') return;

    if (user.role === 'customer' && invoice.customer.id !== user.userId) {
      throw new ForbiddenException('Access denied');
    }
  }
}
