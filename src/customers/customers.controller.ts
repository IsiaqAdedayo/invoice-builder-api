import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Post()
  create(@Body(ValidationPipe) createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get(':id')
  findOne(@Param('id') publicId: string) {
    return this.customersService.findOne(publicId);
  }

  /**
   * GET /customers/:id/invoices
   * Returns all invoices scoped to this customer.
   * ⚠️ In production: verify req.user.customerId === id before serving.
   */
  @Get(':id/invoices')
  findCustomerInvoices(@Param('id') customerId: string) {
    return this.customersService.findCustomerInvoices(customerId);
  }
}
