import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { AnalyticsService } from 'src/analytics/analytics.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CreateInvoiceDto, InvoiceStatus } from './dto/create-invoice.dto';
import { InvoicesService } from './invoices.service';
import type { InvoiceQuery } from './invoices.service';

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /** Legacy dashboard endpoint */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('dashboard')
  getDashboard() {
    return this.analyticsService.getDashboardStats();
  }

  /** GET /invoices/recent?limit=5 — last N invoices for dashboard table */
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('recent')
  findRecent(@Query('limit') limit?: string) {
    return this.invoicesService.findRecent(limit ? Number(limit) : 5);
  }

  /** GET /invoices?status=paid&search=acme&page=1&limit=10&sortBy=createdAt&order=DESC */
  @Get()
  findAll(@Query() query: InvoiceQuery) {
    return this.invoicesService.findAll(query);
  }

  @Post()
  create(@Body(ValidationPipe) createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: InvoiceStatus) {
    return this.invoicesService.updateStatus(id, status);
  }

  @Get(':id/pdf')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.invoicesService.generateInvoicePdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
    });

    res.send(pdfBuffer);
  }

  @Post(':id/pay')
  payInvoice(@Param('id') id: string, @Body('amount') amount: number) {
    return this.invoicesService.processPayment(id, amount);
  }

  @Post(':id/refund')
  refund(@Param('id') id: string) {
    return this.invoicesService.refundInvoice(id);
  }
}
