import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  create(createCustomerDto: CreateCustomerDto) {
    const customer = this.customerRepo.create(createCustomerDto);
    return this.customerRepo.save(customer);
  }

  findAll() {
    return this.customerRepo.find();
  }

  findOne(id: number) {
    return this.customerRepo.findOne({ where: { id } });
  }
}
