/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceDto } from './create-invoice.dto';
import { PartialType } from '@nestjs/mapped-types';

class CreateInvoiceItemDto {
  description: string;
  quantity: number;
  unitPrice: number;
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
