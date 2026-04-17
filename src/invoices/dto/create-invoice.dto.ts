// create-invoice.dto.ts

import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

class CreateInvoiceItemDto {
  description: string;

  @Min(1)
  quantity: number;

  @Min(0)
  unitPrice: number;
}

class DiscountDto {
  @IsEnum(['percentage', 'fixed'])
  type: 'percentage' | 'fixed';

  @IsNumber()
  @Min(0)
  value: number;
}

class TaxDto {
  @IsNumber()
  @Min(0)
  rate: number;
}

export class CreateInvoiceDto {
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;

  @IsString()
  customerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountDto)
  discount?: DiscountDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TaxDto)
  tax?: TaxDto;

  @IsNumber()
  @IsOptional()
  userId?: number;
}
