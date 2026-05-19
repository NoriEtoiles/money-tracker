import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { decimalAmountPattern } from "../../../common/validation/money";
import { accountTypes, AccountType } from "./account-type";

export class CreateAccountDto {
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsString()
  @Matches(decimalAmountPattern)
  initialBalance!: string;

  @IsBoolean()
  @IsOptional()
  includeInNetWorth?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  institutionName?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsIn(accountTypes)
  type!: AccountType;
}
