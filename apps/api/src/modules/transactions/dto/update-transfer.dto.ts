import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { decimalAmountPattern } from "../../../common/validation/money";

export class UpdateTransferDto {
  @IsOptional()
  @IsString()
  @Matches(decimalAmountPattern)
  amount?: string;

  @IsOptional()
  @IsUUID()
  fromAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsUUID()
  toAccountId?: string;

  @IsDateString()
  @IsOptional()
  transactionAt?: string;
}
