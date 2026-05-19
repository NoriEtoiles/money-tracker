import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { decimalAmountPattern } from "../../../common/validation/money";
import { transactionTypes, TransactionType } from "./transaction-type";

export class CreateTransactionDto {
  @IsUUID()
  accountId!: string;

  @IsString()
  @Matches(decimalAmountPattern)
  amount!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  merchant?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsDateString()
  transactionAt!: string;

  @IsIn(transactionTypes)
  type!: TransactionType;
}
