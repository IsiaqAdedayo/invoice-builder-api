import { IsOptional, IsNumberString, IsString, IsIn } from 'class-validator';

export class QueryUsersDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsIn(['admin', 'user'])
  role?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
