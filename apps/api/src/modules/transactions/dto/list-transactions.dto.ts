import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { decimalAmountPattern } from "../../../common/validation/money";
import { transactionTypes, TransactionType } from "./transaction-type";

export class ListTransactionsDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsInt()
  @IsOptional()
  @Max(100)
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  @Matches(decimalAmountPattern)
  maxAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(decimalAmountPattern)
  minAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsIn(transactionTypes)
  @IsOptional()
  type?: TransactionType;
}
