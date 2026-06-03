import { Type } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";

export const amountSignConventions = ["positive_income", "positive_expense"] as const;
export type AmountSignConvention = typeof amountSignConventions[number];

export class CsvImportMappingDto {
  @IsString()
  @MaxLength(120)
  @MinLength(1)
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @MinLength(1)
  merchant?: string;

  @IsString()
  @MaxLength(120)
  @MinLength(1)
  transactionAt!: string;
}

export class PreviewCsvImportDto {
  @IsUUID()
  accountId!: string;

  @IsIn(amountSignConventions)
  amountSignConvention!: AmountSignConvention;

  @Type(() => CsvImportMappingDto)
  @ValidateNested()
  mapping!: CsvImportMappingDto;
}
