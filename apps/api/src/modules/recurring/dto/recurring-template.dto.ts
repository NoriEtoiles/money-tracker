import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { decimalAmountPattern } from "../../../common/validation/money";
import { transactionTypes, TransactionType } from "../../transactions/dto/transaction-type";

export class RecurringTemplateDto {
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

  @IsIn(transactionTypes)
  type!: TransactionType;
}
