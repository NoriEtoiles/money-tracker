import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { decimalAmountPattern } from "../../../common/validation/money";

export class CreateTransferDto {
  @IsString()
  @Matches(decimalAmountPattern)
  amount!: string;

  @IsUUID()
  fromAccountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsUUID()
  toAccountId!: string;

  @IsDateString()
  transactionAt!: string;
}
