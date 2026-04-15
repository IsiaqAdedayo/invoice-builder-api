/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsNumber, IsString, Min } from 'class-validator';

export class CreateInvoiceItemDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}
