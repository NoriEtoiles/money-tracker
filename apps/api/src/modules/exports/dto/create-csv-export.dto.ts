import { IsIn, IsOptional, IsString, IsUUID, Matches } from "class-validator";

export const csvExportTypes = ["transactions_csv"] as const;
export type CsvExportType = typeof csvExportTypes[number];

export const exportTransactionTypes = ["income", "expense", "transfer"] as const;
export type ExportTransactionType = typeof exportTransactionTypes[number];

export class CreateCsvExportDto {
  @IsIn(csvExportTypes)
  exportType!: CsvExportType;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsIn(exportTransactionTypes)
  @IsOptional()
  transactionType?: ExportTransactionType;
}
