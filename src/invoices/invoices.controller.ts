import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('dashboard')
  getDashboard() {
    return this.analyticsService.getDashboardStats();
  }

  @Post()
  create(@Body(ValidationPipe) createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: number, @Body('status') status: InvoiceStatus) {
    return this.invoicesService.updateStatus(+id, status);
  }

  @Get()
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get(':id/pdf')
  async getPdf(@Param('id') id: number, @Res() res: Response) {
    const pdfBuffer = await this.invoicesService.generateInvoicePdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
    });

    res.send(pdfBuffer);
  }

  @Post(':id/pay')
  payInvoice(@Param('id') id: number, @Body('amount') amount: number) {
    return this.invoicesService.processPayment(id, amount);
  }

  @Post(':id/refund')
  refund(@Param('id') id: number) {
    return this.invoicesService.refundInvoice(id);
  }
}
