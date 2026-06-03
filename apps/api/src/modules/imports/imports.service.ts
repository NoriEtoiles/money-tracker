import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CsvImport, Prisma } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { DateTime } from "luxon";
import { PrismaService } from "../../prisma/prisma.service";
import { ListImportsDto } from "./dto/list-imports.dto";
import {
  AmountSignConvention,
  CsvImportMappingDto,
  PreviewCsvImportDto
} from "./dto/preview-csv-import.dto";

export const maxCsvFileBytes = 1024 * 1024;
const maxCsvColumns = 50;
const maxCsvRows = 1000;
const importExpiryMilliseconds = 24 * 60 * 60 * 1000;
const signedDecimalPattern = /^[+-]?(0|[1-9]\d*)(\.\d{1,4})?$/;
const acceptedMimeTypes = new Set([
  "",
  "application/csv",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain"
]);

export type CsvImportUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type CsvImportSummary = {
  expenseRowCount: number;
  importedRowCount: number;
  incomeRowCount: number;
  invalidRowCount: number;
  totalRowCount: number;
  validRowCount: number;
};

export type CsvImportHistoryItem = {
  completedAt: string | null;
  createdAt: string;
  expiresAt: string;
  filename: string;
  id: string;
  status: string;
  summary: CsvImportSummary;
};

export type CsvImportHistoryListResponse = {
  items: CsvImportHistoryItem[];
  nextCursor: string | null;
};

export type CsvImportUploadResponse = {
  detectedColumns: string[];
  expiresAt: string;
  filename: string;
  importId: string;
  rowCount: number;
  status: "mapping_required";
};

export type CsvImportRowError = {
  code: string;
  field: "amount" | "merchant" | "transactionAt";
  message: string;
};

export type CsvImportPreviewRow = {
  amount: string | null;
  currency: string;
  errors: CsvImportRowError[];
  merchant: string | null;
  rowNumber: number;
  transactionAt: string | null;
  type: "expense" | "income" | null;
};

export type CsvImportPreviewResponse = {
  importId: string;
  rows: CsvImportPreviewRow[];
  status: "ready_to_import" | "validation_failed";
  summary: CsvImportSummary;
};

export type CsvImportConfirmResponse = CsvImportHistoryItem;

type StagedCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type StagedCsvPayload = {
  columns: string[];
  rows: StagedCsvRow[];
};

type StoredPreviewMapping = PreviewCsvImportDto;

type ActiveImport = Pick<
  CsvImport,
  "completedAt" | "createdAt" | "expiresAt" | "filename" | "id" | "mapping" | "stagedRows" | "status" | "summary"
>;

type NormalizedRows = {
  rows: CsvImportPreviewRow[];
  summary: CsvImportSummary;
};

type CsvRecord = {
  info: {
    lines: number;
  };
  record: string[];
};

type ImportDataClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadCsv(
    userId: string,
    file: CsvImportUploadFile | undefined,
    now = new Date()
  ): Promise<CsvImportUploadResponse> {
    if (file === undefined) {
      throw new BadRequestException("CSV file is required");
    }

    this.assertUploadFile(file);
    const stagedRows = this.parseCsv(file.buffer);
    const filename = this.sanitizeFilename(file.originalname);
    const expiresAt = new Date(now.getTime() + importExpiryMilliseconds);
    const summary = this.emptySummary(stagedRows.rows.length);
    const csvImport = await this.prisma.csvImport.create({
      data: {
        expiresAt,
        filename,
        stagedRows: stagedRows as unknown as Prisma.InputJsonValue,
        status: "mapping_required",
        summary: summary as unknown as Prisma.InputJsonValue,
        userId
      }
    });

    return {
      detectedColumns: stagedRows.columns,
      expiresAt: expiresAt.toISOString(),
      filename,
      importId: csvImport.id,
      rowCount: stagedRows.rows.length,
      status: "mapping_required"
    };
  }

  async previewImport(
    userId: string,
    importId: string,
    dto: PreviewCsvImportDto,
    now = new Date()
  ): Promise<CsvImportPreviewResponse> {
    const csvImport = await this.getImport(userId, importId);
    this.assertImportAvailable(csvImport, now);
    const stagedRows = this.parseStagedRows(csvImport.stagedRows);
    this.assertMapping(dto.mapping, stagedRows.columns);
    const account = await this.getActiveAccount(this.prisma, userId, dto.accountId);
    const timezone = await this.getUserTimezone(this.prisma, userId);
    const normalized = this.normalizeRows(stagedRows.rows, dto, account.currency, timezone);
    const status = normalized.summary.invalidRowCount === 0
      ? "ready_to_import"
      : "validation_failed";

    await this.prisma.csvImport.update({
      data: {
        mapping: dto as unknown as Prisma.InputJsonValue,
        status,
        summary: normalized.summary as unknown as Prisma.InputJsonValue
      },
      where: {
        id: csvImport.id
      }
    });

    return {
      importId,
      rows: normalized.rows,
      status,
      summary: normalized.summary
    };
  }

  async confirmImport(
    userId: string,
    importId: string,
    now = new Date()
  ): Promise<CsvImportConfirmResponse> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const csvImport = await tx.csvImport.findFirst({
          where: {
            id: importId,
            userId
          }
        });

        if (csvImport === null) {
          throw new NotFoundException("Import not found");
        }

        if (csvImport.status === "completed") {
          return this.toHistoryItem(csvImport);
        }

        this.assertImportAvailable(csvImport, now);
        const stagedRows = this.parseStagedRows(csvImport.stagedRows);
        const mapping = this.parseStoredMapping(csvImport.mapping);
        this.assertMapping(mapping.mapping, stagedRows.columns);
        const account = await this.getActiveAccount(tx, userId, mapping.accountId);
        const timezone = await this.getUserTimezone(tx, userId);
        const normalized = this.normalizeRows(stagedRows.rows, mapping, account.currency, timezone);

        if (normalized.summary.invalidRowCount > 0) {
          throw new BadRequestException("Import contains invalid rows");
        }

        await tx.transaction.createMany({
          data: normalized.rows.map((row) => ({
            accountId: account.id,
            amount: new Prisma.Decimal(row.amount as string),
            currency: account.currency,
            importId,
            importRowNumber: row.rowNumber,
            merchant: row.merchant,
            source: "import",
            transactionAt: new Date(row.transactionAt as string),
            type: row.type as "expense" | "income",
            userId
          }))
        });
        const balanceDelta = normalized.rows.reduce(
          (total, row) => row.type === "income"
            ? total.plus(row.amount as string)
            : total.minus(row.amount as string),
          new Prisma.Decimal(0)
        );

        await tx.account.update({
          data: {
            currentBalance: {
              increment: balanceDelta
            }
          },
          where: {
            id: account.id
          }
        });

        const completedSummary = {
          ...normalized.summary,
          importedRowCount: normalized.summary.validRowCount
        };
        const completedImport = await tx.csvImport.update({
          data: {
            completedAt: now,
            mapping: Prisma.DbNull,
            stagedRows: Prisma.DbNull,
            status: "completed",
            summary: completedSummary as unknown as Prisma.InputJsonValue
          },
          where: {
            id: importId
          }
        });

        await tx.auditEvent.create({
          data: {
            entityId: importId,
            entityType: "import",
            eventType: "csv_import_confirm",
            metadata: {
              expenseRowCount: completedSummary.expenseRowCount,
              importedRowCount: completedSummary.importedRowCount,
              incomeRowCount: completedSummary.incomeRowCount
            },
            userId
          }
        });

        return this.toHistoryItem(completedImport);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2002"
      ) {
        const csvImport = await this.prisma.csvImport.findFirst({
          where: {
            id: importId,
            status: "completed",
            userId
          }
        });

        if (csvImport !== null) {
          return this.toHistoryItem(csvImport);
        }
      }

      throw error;
    }
  }

  async listImports(
    userId: string,
    dto: ListImportsDto,
    now = new Date()
  ): Promise<CsvImportHistoryListResponse> {
    await this.cleanupExpiredImports(now);
    const limit = dto.limit ?? 20;
    const imports = await this.prisma.csvImport.findMany({
      cursor: dto.cursor !== undefined ? { id: dto.cursor } : undefined,
      orderBy: [
        {
          createdAt: "desc"
        },
        {
          id: "desc"
        }
      ],
      skip: dto.cursor !== undefined ? 1 : 0,
      take: limit + 1,
      where: {
        userId
      }
    });
    const hasNextPage = imports.length > limit;
    const items = imports.slice(0, limit);

    return {
      items: items.map((csvImport) => this.toHistoryItem(csvImport)),
      nextCursor: hasNextPage ? items[items.length - 1]?.id ?? null : null
    };
  }

  async cleanupExpiredImports(now = new Date()): Promise<number> {
    const result = await this.prisma.csvImport.updateMany({
      data: {
        mapping: Prisma.DbNull,
        stagedRows: Prisma.DbNull,
        status: "expired"
      },
      where: {
        completedAt: null,
        expiresAt: {
          lte: now
        },
        status: {
          not: "expired"
        }
      }
    });

    return result.count;
  }

  private assertUploadFile(file: CsvImportUploadFile): void {
    if (!file.originalname.toLowerCase().endsWith(".csv")) {
      throw new BadRequestException("File must use .csv extension");
    }

    if (!acceptedMimeTypes.has(file.mimetype.toLowerCase())) {
      throw new BadRequestException("File must use a supported CSV content type");
    }

    if (file.size === 0 || file.buffer.byteLength === 0) {
      throw new BadRequestException("CSV file must not be empty");
    }

    if (file.size > maxCsvFileBytes || file.buffer.byteLength > maxCsvFileBytes) {
      throw new BadRequestException("CSV file must not exceed 1 MiB");
    }
  }

  private parseCsv(buffer: Buffer): StagedCsvPayload {
    let text: string;

    try {
      text = new TextDecoder("utf-8", {
        fatal: true
      }).decode(buffer);
    } catch {
      throw new BadRequestException("CSV file must use UTF-8 encoding");
    }

    if (text.trim().length === 0) {
      throw new BadRequestException("CSV file must not be empty");
    }

    const delimiter = this.detectDelimiter(text);
    let parsed: CsvRecord[];

    try {
      parsed = parse(text, {
        bom: true,
        delimiter,
        info: true,
        skip_empty_lines: true
      }) as unknown as CsvRecord[];
    } catch {
      throw new BadRequestException("CSV file could not be parsed");
    }

    if (parsed.length < 2) {
      throw new BadRequestException("CSV file must include a header and at least one data row");
    }

    const columns = parsed[0]?.record.map((column) => column.trim()) ?? [];
    this.assertColumns(columns);
    const rows = parsed.slice(1).map((row) => ({
      rowNumber: row.info.lines,
      values: Object.fromEntries(columns.map((column, index) => [
        column,
        row.record[index] ?? ""
      ]))
    }));

    if (rows.length > maxCsvRows) {
      throw new BadRequestException(`CSV file must not exceed ${maxCsvRows} data rows`);
    }

    return {
      columns,
      rows
    };
  }

  private detectDelimiter(text: string): "," | ";" {
    const commaCount = this.getHeaderColumnCount(text, ",");
    const semicolonCount = this.getHeaderColumnCount(text, ";");

    return semicolonCount > commaCount ? ";" : ",";
  }

  private getHeaderColumnCount(text: string, delimiter: "," | ";"): number {
    try {
      const records = parse(text, {
        bom: true,
        delimiter,
        relax_column_count: true,
        skip_empty_lines: true,
        to_line: 1
      }) as string[][];

      return records[0]?.length ?? 0;
    } catch {
      return 0;
    }
  }

  private assertColumns(columns: string[]): void {
    if (columns.length === 0 || columns.length > maxCsvColumns) {
      throw new BadRequestException(`CSV file must include between 1 and ${maxCsvColumns} columns`);
    }

    if (columns.some((column) => column.length === 0 || column.length > 120)) {
      throw new BadRequestException("CSV headers must be non-empty and at most 120 characters");
    }

    const normalizedColumns = columns.map((column) => column.toLocaleLowerCase());

    if (new Set(normalizedColumns).size !== normalizedColumns.length) {
      throw new BadRequestException("CSV headers must be unique");
    }
  }

  private assertMapping(mapping: CsvImportMappingDto, columns: string[]): void {
    const selectedColumns = [mapping.transactionAt, mapping.amount, mapping.merchant]
      .filter((column): column is string => column !== undefined);

    if (selectedColumns.some((column) => !columns.includes(column))) {
      throw new BadRequestException("Mapped columns must exist in the uploaded CSV");
    }

    if (new Set(selectedColumns).size !== selectedColumns.length) {
      throw new BadRequestException("Each mapped field must use a different CSV column");
    }
  }

  private normalizeRows(
    stagedRows: StagedCsvRow[],
    mapping: StoredPreviewMapping,
    currency: string,
    timezone: string
  ): NormalizedRows {
    const rows = stagedRows.map((row) =>
      this.normalizeRow(row, mapping.mapping, mapping.amountSignConvention, currency, timezone)
    );
    const validRows = rows.filter((row) => row.errors.length === 0);

    return {
      rows,
      summary: {
        expenseRowCount: validRows.filter((row) => row.type === "expense").length,
        importedRowCount: 0,
        incomeRowCount: validRows.filter((row) => row.type === "income").length,
        invalidRowCount: rows.length - validRows.length,
        totalRowCount: rows.length,
        validRowCount: validRows.length
      }
    };
  }

  private normalizeRow(
    row: StagedCsvRow,
    mapping: CsvImportMappingDto,
    amountSignConvention: AmountSignConvention,
    currency: string,
    timezone: string
  ): CsvImportPreviewRow {
    const errors: CsvImportRowError[] = [];
    const transactionAt = this.parseTransactionAt(
      row.values[mapping.transactionAt]?.trim() ?? "",
      timezone,
      errors
    );
    const amount = this.parseAmount(
      row.values[mapping.amount]?.trim() ?? "",
      amountSignConvention,
      errors
    );
    const merchant = this.parseMerchant(
      mapping.merchant === undefined ? "" : row.values[mapping.merchant]?.trim() ?? "",
      errors
    );

    return {
      amount: amount?.amount ?? null,
      currency,
      errors,
      merchant,
      rowNumber: row.rowNumber,
      transactionAt,
      type: amount?.type ?? null
    };
  }

  private parseTransactionAt(
    value: string,
    timezone: string,
    errors: CsvImportRowError[]
  ): string | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = DateTime.fromISO(value, {
        zone: timezone
      });

      if (date.isValid && date.toFormat("yyyy-MM-dd") === value) {
        return date.startOf("day").toUTC().toISO();
      }
    }

    if (/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
      const date = DateTime.fromISO(value, {
        setZone: true
      });

      if (date.isValid) {
        return date.toUTC().toISO();
      }
    }

    errors.push({
      code: "INVALID_DATE",
      field: "transactionAt",
      message: "Date must use YYYY-MM-DD or ISO 8601 datetime with an explicit offset"
    });

    return null;
  }

  private parseAmount(
    value: string,
    amountSignConvention: AmountSignConvention,
    errors: CsvImportRowError[]
  ): { amount: string; type: "expense" | "income" } | null {
    if (!signedDecimalPattern.test(value)) {
      errors.push({
        code: "INVALID_AMOUNT",
        field: "amount",
        message: "Amount must be a signed decimal using . as separator"
      });

      return null;
    }

    const amount = new Prisma.Decimal(value);

    if (amount.eq(0)) {
      errors.push({
        code: "ZERO_AMOUNT",
        field: "amount",
        message: "Amount must not be zero"
      });

      return null;
    }

    const positiveMeansIncome = amountSignConvention === "positive_income";
    const isIncome = amount.gt(0) === positiveMeansIncome;

    return {
      amount: amount.abs().toFixed(4),
      type: isIncome ? "income" : "expense"
    };
  }

  private parseMerchant(value: string, errors: CsvImportRowError[]): string | null {
    if (value.length > 120) {
      errors.push({
        code: "MERCHANT_TOO_LONG",
        field: "merchant",
        message: "Merchant must not exceed 120 characters"
      });

      return null;
    }

    return value.length === 0 ? null : value;
  }

  private async getImport(userId: string, importId: string): Promise<ActiveImport> {
    const csvImport = await this.prisma.csvImport.findFirst({
      where: {
        id: importId,
        userId
      }
    });

    if (csvImport === null) {
      throw new NotFoundException("Import not found");
    }

    return csvImport;
  }

  private assertImportAvailable(csvImport: ActiveImport, now: Date): void {
    if (csvImport.status === "completed") {
      throw new BadRequestException("Import is already completed");
    }

    if (csvImport.status === "expired" || csvImport.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException("Import staging has expired");
    }
  }

  private async getActiveAccount(
    client: ImportDataClient,
    userId: string,
    accountId: string
  ): Promise<{ currency: string; id: string }> {
    const account = await client.account.findFirst({
      select: {
        currency: true,
        id: true
      },
      where: {
        archivedAt: null,
        deletedAt: null,
        id: accountId,
        userId
      }
    });

    if (account === null) {
      throw new NotFoundException("Account not found");
    }

    return account;
  }

  private async getUserTimezone(client: ImportDataClient, userId: string): Promise<string> {
    const user = await client.user.findFirst({
      select: {
        timezone: true
      },
      where: {
        deletedAt: null,
        id: userId,
        status: "active"
      }
    });

    if (user === null) {
      throw new NotFoundException("User not found");
    }

    return user.timezone;
  }

  private parseStagedRows(value: Prisma.JsonValue | null): StagedCsvPayload {
    if (!this.isObject(value) || !Array.isArray(value.columns) || !Array.isArray(value.rows)) {
      throw new BadRequestException("Import staging payload is unavailable");
    }

    const columns = value.columns;
    const rows = value.rows;

    if (!columns.every((column) => typeof column === "string")) {
      throw new BadRequestException("Import staging payload is invalid");
    }

    const parsedRows = rows.map((row) => {
      if (
        !this.isObject(row)
        || typeof row.rowNumber !== "number"
        || !this.isObject(row.values)
        || !Object.values(row.values).every((cell) => typeof cell === "string")
      ) {
        throw new BadRequestException("Import staging payload is invalid");
      }

      return {
        rowNumber: row.rowNumber,
        values: row.values as Record<string, string>
      };
    });

    return {
      columns: columns as string[],
      rows: parsedRows
    };
  }

  private parseStoredMapping(value: Prisma.JsonValue | null): StoredPreviewMapping {
    if (
      !this.isObject(value)
      || typeof value.accountId !== "string"
      || (value.amountSignConvention !== "positive_income"
        && value.amountSignConvention !== "positive_expense")
      || !this.isObject(value.mapping)
      || typeof value.mapping.amount !== "string"
      || typeof value.mapping.transactionAt !== "string"
      || (value.mapping.merchant !== undefined && typeof value.mapping.merchant !== "string")
    ) {
      throw new BadRequestException("Import must be previewed before confirmation");
    }

    return value as unknown as StoredPreviewMapping;
  }

  private emptySummary(totalRowCount: number): CsvImportSummary {
    return {
      expenseRowCount: 0,
      importedRowCount: 0,
      incomeRowCount: 0,
      invalidRowCount: 0,
      totalRowCount,
      validRowCount: 0
    };
  }

  private parseSummary(value: Prisma.JsonValue | null): CsvImportSummary {
    if (
      !this.isObject(value)
      || typeof value.expenseRowCount !== "number"
      || typeof value.importedRowCount !== "number"
      || typeof value.incomeRowCount !== "number"
      || typeof value.invalidRowCount !== "number"
      || typeof value.totalRowCount !== "number"
      || typeof value.validRowCount !== "number"
    ) {
      return this.emptySummary(0);
    }

    return value as CsvImportSummary;
  }

  private sanitizeFilename(filename: string): string {
    const basename = filename.split(/[\\/]/).pop() ?? "import.csv";
    const sanitized = basename.replace(/[\u0000-\u001f\u007f]/g, "").trim();

    return (sanitized.length === 0 ? "import.csv" : sanitized).slice(0, 255);
  }

  private toHistoryItem(csvImport: ActiveImport): CsvImportHistoryItem {
    return {
      completedAt: csvImport.completedAt?.toISOString() ?? null,
      createdAt: csvImport.createdAt.toISOString(),
      expiresAt: csvImport.expiresAt.toISOString(),
      filename: csvImport.filename,
      id: csvImport.id,
      status: csvImport.status,
      summary: this.parseSummary(csvImport.summary)
    };
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
