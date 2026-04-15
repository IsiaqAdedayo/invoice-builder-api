import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Customer } from 'src/customers/entities/customer.entity';
import { PdfService } from 'src/pdf/pdf.service';
import { DataSource, Repository } from 'typeorm';

import { AuditService } from 'src/audit/audit.service';
import { Payment } from 'src/payments/entities/payment.entity';
import { InvoiceCalculator } from './domain/invoice-calculator';
import { InvoiceDomain } from './domain/invoice.domain';
import { CreateInvoiceDto, InvoiceStatus } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Invoice } from './entities/invoice.entity';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,

    private readonly dataSource: DataSource,

    private readonly pdfService: PdfService,

    private readonly auditService: AuditService,

    private readonly mailService: MailService,
  ) {}

  // ----------------------------
  // CREATE INVOICE
  // ----------------------------
  async create(dto: CreateInvoiceDto) {
    const { customerId, items, status, discount, tax } = dto;

    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new BadRequestException('Customer does not exist');
    }

    if (status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot create already paid invoice');
    }

    const calculatedItems = InvoiceCalculator.calculateItems(items);

    const totalAmount = InvoiceCalculator.calculateTotal(
      calculatedItems,
      discount,
      tax,
    );

    const invoice = this.invoiceRepo.create({
      customer,
      status,
      totalAmount,
      discount,
      tax,
      items: calculatedItems,
      isLocked: false,
    });

    const saved = await this.invoiceRepo.save(invoice);

    await this.auditService.log({
      entity: 'Invoice',
      entityId: saved.id,
      action: 'CREATE',
      after: saved,
      performedBy: dto.userId, // later from JWT
    });

    return this.invoiceRepo.findOne({
      where: { id: saved.id },
      relations: ['customer', 'items'],
    });
  }

  // ----------------------------
  // UPDATE INVOICE (STRICT RULES)
  // ----------------------------
  async updateInvoice(invoiceId: number, dto: UpdateInvoiceDto) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
      relations: ['items', 'customer'],
    });

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    // DOMAIN RULE: cannot modify locked invoices
    InvoiceDomain.assertCanModify(invoice);

    const newItems = InvoiceCalculator.calculateItems(dto.items);

    const totalAmount = InvoiceCalculator.calculateTotal(
      newItems,
      dto.discount,
      dto.tax,
    );

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    invoice.items = newItems;
    invoice.totalAmount = totalAmount;

    await this.auditService.log({
      entity: 'Invoice',
      entityId: invoice.id,
      action: 'UPDATE',
      before: invoice,
      after: invoice,
    });

    return this.invoiceRepo.save(invoice);
  }

  // ----------------------------
  // STATUS TRANSITION
  // ----------------------------
  async updateStatus(invoiceId: number, status: InvoiceStatus) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    InvoiceDomain.assertCanModify(invoice);

    const transitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      draft: [InvoiceStatus.PENDING],
      pending: [InvoiceStatus.PAID],
      paid: [],
      refunded: [],
    };

    if (!transitions[invoice.status].includes(status)) {
      throw new BadRequestException(
        `Invalid transition from ${invoice.status} to ${status}`,
      );
    }

    invoice.status = status;

    // AUTO LOCK
    if (status === InvoiceStatus.PAID) {
      InvoiceDomain.lock(invoice);
    }

    await this.auditService.log({
      entity: 'Invoice',
      entityId: invoice.id,
      action: 'STATUS_CHANGE',
      before: { status: invoice.status },
      after: { status: status },
    });

    return this.invoiceRepo.save(invoice);
  }

  // ----------------------------
  // PDF
  // ----------------------------
  async generateInvoicePdf(id: number) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['customer', 'items'],
    });

    if (!invoice) {
      throw new BadRequestException('Invoice not found');
    }

    return this.pdfService.generateInvoicePdf(invoice);
  }

  // ----------------------------
  // READ
  // ----------------------------
  findAll() {
    return this.invoiceRepo.find({
      relations: ['customer', 'items'],
    });
  }

  // ----------------------------
  // PROCESS PAYMENT
  // ----------------------------
  async processPayment(invoiceId: number, amount: number) {
    const result = await this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      const paymentRepo = manager.getRepository(Payment);

      const invoice = await invoiceRepo.findOne({
        where: { id: invoiceId },
        relations: ['customer', 'items', 'payments'],
      });

      if (!invoice) {
        throw new BadRequestException('Invoice not found');
      }

      InvoiceDomain.assertCanModify(invoice);

      if (amount !== invoice.totalAmount) {
        throw new BadRequestException('Invalid payment amount');
      }

      const payment = paymentRepo.create({
        amount,
        status: 'success',
        type: 'payment',
        invoice,
      });

      await paymentRepo.save(payment);

      invoice.status = InvoiceStatus.PAID;
      InvoiceDomain.lock(invoice);

      await invoiceRepo.save(invoice);

      return { invoice, payment };
    });

    // ----------------------------
    // ✅ AUTOMATION (OUTSIDE TX)
    // ----------------------------

    const fullInvoice = await this.invoiceRepo.findOne({
      where: { id: result.invoice.id },
      relations: ['customer', 'items'],
    });

    if (fullInvoice) {
      const pdf = await this.pdfService.generateInvoicePdf(fullInvoice);

      await this.mailService.sendInvoiceEmail(fullInvoice.customer.email, pdf);
    }

    await this.auditService.log({
      entity: 'Invoice',
      entityId: result.invoice.id,
      action: 'PAYMENT',
      after: result.invoice,
    });

    return {
      message: 'Payment successful',
      ...result,
    };
  }

  // ----------------------------
  // Refund Flow
  // ----------------------------
  async refundInvoice(invoiceId: number) {
    return this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      const paymentRepo = manager.getRepository(Payment);

      const invoice = await invoiceRepo.findOne({
        where: { id: invoiceId },
        relations: ['payments'],
      });

      if (!invoice) {
        throw new BadRequestException('Invoice not found');
      }

      // 🔐 DOMAIN RULE
      InvoiceDomain.assertCanRefund(invoice);

      // 1. create refund record
      const refund = paymentRepo.create({
        amount: invoice.totalAmount,
        status: 'success',
        type: 'refund',
        invoice,
      });

      await paymentRepo.save(refund);

      // 2. update invoice state
      InvoiceDomain.markRefunded(invoice);

      await invoiceRepo.save(invoice);

      await this.auditService.log({
        entity: 'Invoice',
        entityId: invoice.id,
        action: 'REFUND',
        before: invoice,
        after: invoice,
      });

      return {
        message: 'Refund successful',
        invoice,
        refund,
      };
    });
  }
}
