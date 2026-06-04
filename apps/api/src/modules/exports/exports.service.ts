import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CsvExport, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  CreateCsvExportDto,
  CsvExportType,
  ExportTransactionType
} from "./dto/create-csv-export.dto";
import { ListExportsDto } from "./dto/list-exports.dto";

const exportExpiryMilliseconds = 15 * 60 * 1000;
const downloadTokenPurpose = "csv_export_download";

export type CsvExportFilters = {
  accountId?: string;
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
  transactionType?: ExportTransactionType;
};

export type CsvExportResponse = {
  completedAt: string | null;
  createdAt: string;
  downloadUrl: string | null;
  expiresAt: string;
  exportId: string;
  exportType: CsvExportType;
  filename: string;
  filters: CsvExportFilters;
  rowCount: number | null;
  status: string;
};

export type CsvExportListResponse = {
  items: CsvExportResponse[];
  nextCursor: string | null;
};

export type CsvExportDownload = {
  contents: string;
  filename: string;
  rowCount: number;
};

type DateRange = {
  dateFrom?: string;
  dateTo?: string;
  endExclusive?: Date;
  start?: Date;
};

type SignedDownloadPayload = {
  exp: number;
  exportId: string;
  purpose: typeof downloadTokenPurpose;
  userId: string;
};

type CsvExportRecord = Pick<
  CsvExport,
  "completedAt" | "createdAt" | "expiresAt" | "exportType" | "filename" | "filters" | "id" | "rowCount" | "status" | "userId"
>;

type ExportTransactionRow = Prisma.TransactionGetPayload<{
  include: {
    account: {
      select: {
        id: true;
        name: true;
        type: true;
      };
    };
    category: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

@Injectable()
export class ExportsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async createExport(
    userId: string,
    dto: CreateCsvExportDto,
    now = new Date()
  ): Promise<CsvExportResponse> {
    const filters = this.normalizeFilters(dto);

    await this.validateFilters(userId, filters);

    const expiresAt = new Date(now.getTime() + exportExpiryMilliseconds);
    const csvExport = await this.prisma.csvExport.create({
      data: {
        expiresAt,
        exportType: dto.exportType,
        filename: this.buildFilename(filters, now),
        filters: filters as unknown as Prisma.InputJsonValue,
        status: "ready",
        userId
      }
    });

    await this.auditService.record({
      entityId: csvExport.id,
      entityType: "export",
      eventType: "csv_export_request",
      metadata: {
        exportType: csvExport.exportType,
        filters,
        status: csvExport.status
      },
      userId
    });

    return this.toResponse(csvExport, now);
  }

  async getExport(
    userId: string,
    exportId: string,
    now = new Date()
  ): Promise<CsvExportResponse> {
    const csvExport = await this.getExportRecord(userId, exportId);
    const currentExport = await this.refreshExpiredStatus(csvExport, now);

    return this.toResponse(currentExport, now);
  }

  async listExports(
    userId: string,
    dto: ListExportsDto,
    now = new Date()
  ): Promise<CsvExportListResponse> {
    await this.expireUserExports(userId, now);

    const limit = dto.limit ?? 20;
    const exports = await this.prisma.csvExport.findMany({
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
    const hasNextPage = exports.length > limit;
    const items = exports.slice(0, limit);

    return {
      items: items.map((csvExport) => this.toResponse(csvExport, now)),
      nextCursor: hasNextPage ? items[items.length - 1]?.id ?? null : null
    };
  }

  async downloadExport(
    userId: string,
    exportId: string,
    token: string | undefined,
    now = new Date()
  ): Promise<CsvExportDownload> {
    if (token === undefined || token.trim().length === 0) {
      throw new BadRequestException("Download token is required");
    }

    const csvExport = await this.getExportRecord(userId, exportId);
    const currentExport = await this.refreshExpiredStatus(csvExport, now);

    if (currentExport.status === "expired" || currentExport.expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException("Export has expired");
    }

    this.verifyDownloadToken(token, userId, exportId, now);

    const filters = this.parseStoredFilters(currentExport.filters);
    await this.validateFilters(userId, filters);
    const rows = await this.findExportRows(userId, filters);
    const contents = this.generateTransactionsCsv(rows);

    const updatedExport = await this.prisma.csvExport.update({
      data: {
        completedAt: now,
        rowCount: rows.length,
        status: "downloaded"
      },
      where: {
        id: currentExport.id
      }
    });

    await this.auditService.record({
      entityId: currentExport.id,
      entityType: "export",
      eventType: "csv_export_download",
      metadata: {
        completedAt: now.toISOString(),
        exportType: currentExport.exportType,
        filters,
        rowCount: rows.length,
        status: updatedExport.status
      },
      userId
    });

    return {
      contents,
      filename: currentExport.filename,
      rowCount: rows.length
    };
  }

  private readonly transactionInclude = {
    account: {
      select: {
        id: true,
        name: true,
        type: true
      }
    },
    category: {
      select: {
        id: true,
        name: true
      }
    }
  } satisfies Prisma.TransactionInclude;

  private readonly csvHeaders = [
    "transaction_id",
    "transaction_at",
    "transaction_type",
    "amount",
    "currency",
    "account_id",
    "account_name",
    "account_type",
    "category_id",
    "category_name",
    "merchant",
    "note",
    "status",
    "source",
    "transfer_group_id",
    "transfer_side"
  ] as const;

  private async getExportRecord(userId: string, exportId: string): Promise<CsvExportRecord> {
    const csvExport = await this.prisma.csvExport.findFirst({
      where: {
        id: exportId,
        userId
      }
    });

    if (csvExport === null) {
      throw new NotFoundException("Export not found");
    }

    return csvExport;
  }

  private async refreshExpiredStatus(
    csvExport: CsvExportRecord,
    now: Date
  ): Promise<CsvExportRecord> {
    if (csvExport.status === "expired" || csvExport.expiresAt.getTime() > now.getTime()) {
      return csvExport;
    }

    return this.prisma.csvExport.update({
      data: {
        status: "expired"
      },
      where: {
        id: csvExport.id
      }
    });
  }

  private async expireUserExports(userId: string, now: Date): Promise<void> {
    await this.prisma.csvExport.updateMany({
      data: {
        status: "expired"
      },
      where: {
        expiresAt: {
          lte: now
        },
        status: {
          not: "expired"
        },
        userId
      }
    });
  }

  private async validateFilters(userId: string, filters: CsvExportFilters): Promise<void> {
    this.parseDateRange(filters);

    if (filters.accountId === undefined) {
      return;
    }

    const account = await this.prisma.account.findFirst({
      select: {
        id: true
      },
      where: {
        deletedAt: null,
        id: filters.accountId,
        userId
      }
    });

    if (account === null) {
      throw new NotFoundException("Account not found");
    }
  }

  private async findExportRows(
    userId: string,
    filters: CsvExportFilters
  ): Promise<ExportTransactionRow[]> {
    const range = this.parseDateRange(filters);

    return this.prisma.transaction.findMany({
      include: this.transactionInclude,
      orderBy: [
        {
          transactionAt: "asc"
        },
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ],
      where: {
        account: {
          deletedAt: null,
          userId
        },
        accountId: filters.accountId,
        currency: filters.currency,
        deletedAt: null,
        isDeleted: false,
        transactionAt: {
          gte: range.start,
          lt: range.endExclusive
        },
        type: filters.transactionType,
        userId
      }
    });
  }

  private generateTransactionsCsv(rows: ExportTransactionRow[]): string {
    const csvRows = [
      this.csvHeaders.join(","),
      ...rows.map((row) => this.toCsvRow(row).join(","))
    ];

    return `${csvRows.join("\n")}\n`;
  }

  private toCsvRow(row: ExportTransactionRow): string[] {
    return [
      this.escapeCsv(row.id),
      this.escapeCsv(row.transactionAt.toISOString()),
      this.escapeCsv(row.type),
      this.escapeCsv(row.amount.toFixed(4)),
      this.escapeCsv(row.currency),
      this.escapeCsv(row.account.id),
      this.escapeCsv(this.safeText(row.account.name)),
      this.escapeCsv(this.safeText(row.account.type)),
      this.escapeCsv(row.category?.id ?? ""),
      this.escapeCsv(this.safeText(row.category?.name ?? "")),
      this.escapeCsv(this.safeText(row.merchant ?? "")),
      this.escapeCsv(this.safeText(row.note ?? "")),
      this.escapeCsv(row.status),
      this.escapeCsv(row.source),
      this.escapeCsv(row.transferGroupId ?? ""),
      this.escapeCsv(row.transferSide ?? "")
    ];
  }

  private escapeCsv(value: string): string {
    if (!/[",\n\r]/.test(value)) {
      return value;
    }

    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  private safeText(value: string): string {
    return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  }

  private normalizeFilters(dto: CreateCsvExportDto): CsvExportFilters {
    const filters: CsvExportFilters = {};

    if (dto.accountId !== undefined) {
      filters.accountId = dto.accountId;
    }

    if (dto.currency !== undefined) {
      filters.currency = dto.currency;
    }

    if (dto.dateFrom !== undefined) {
      filters.dateFrom = dto.dateFrom;
    }

    if (dto.dateTo !== undefined) {
      filters.dateTo = dto.dateTo;
    }

    if (dto.transactionType !== undefined) {
      filters.transactionType = dto.transactionType;
    }

    return filters;
  }

  private parseStoredFilters(value: Prisma.JsonValue): CsvExportFilters {
    if (!this.isObject(value)) {
      throw new BadRequestException("Export filters are invalid");
    }

    const filters = value as Record<string, unknown>;
    const parsed: CsvExportFilters = {};

    if (filters.accountId !== undefined) {
      if (typeof filters.accountId !== "string") {
        throw new BadRequestException("Export filters are invalid");
      }

      parsed.accountId = filters.accountId;
    }

    if (filters.currency !== undefined) {
      if (typeof filters.currency !== "string") {
        throw new BadRequestException("Export filters are invalid");
      }

      parsed.currency = filters.currency;
    }

    if (filters.dateFrom !== undefined) {
      if (typeof filters.dateFrom !== "string") {
        throw new BadRequestException("Export filters are invalid");
      }

      parsed.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo !== undefined) {
      if (typeof filters.dateTo !== "string") {
        throw new BadRequestException("Export filters are invalid");
      }

      parsed.dateTo = filters.dateTo;
    }

    if (filters.transactionType !== undefined) {
      if (
        filters.transactionType !== "income"
        && filters.transactionType !== "expense"
        && filters.transactionType !== "transfer"
      ) {
        throw new BadRequestException("Export filters are invalid");
      }

      parsed.transactionType = filters.transactionType;
    }

    return parsed;
  }

  private parseDateRange(filters: CsvExportFilters): DateRange {
    const start = filters.dateFrom !== undefined
      ? this.parseDateOnly(filters.dateFrom, "dateFrom")
      : undefined;
    const dateTo = filters.dateTo !== undefined
      ? this.parseDateOnly(filters.dateTo, "dateTo")
      : undefined;
    const endExclusive = dateTo === undefined ? undefined : this.nextUtcDay(dateTo);

    if (start !== undefined && dateTo !== undefined && start.getTime() > dateTo.getTime()) {
      throw new BadRequestException("dateFrom must be before or equal to dateTo");
    }

    return {
      dateFrom: start === undefined ? undefined : this.toDateOnly(start),
      dateTo: dateTo === undefined ? undefined : this.toDateOnly(dateTo),
      endExclusive,
      start
    };
  }

  private parseDateOnly(value: string, fieldName: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (match === null) {
      throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${fieldName} must be a valid calendar date`);
    }

    return date;
  }

  private nextUtcDay(date: Date): Date {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + 1
    ));
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toResponse(csvExport: CsvExportRecord, now: Date): CsvExportResponse {
    const status = csvExport.expiresAt.getTime() <= now.getTime() && csvExport.status !== "expired"
      ? "expired"
      : csvExport.status;

    return {
      completedAt: csvExport.completedAt?.toISOString() ?? null,
      createdAt: csvExport.createdAt.toISOString(),
      downloadUrl: status === "expired" ? null : this.buildDownloadUrl(csvExport),
      expiresAt: csvExport.expiresAt.toISOString(),
      exportId: csvExport.id,
      exportType: csvExport.exportType as CsvExportType,
      filename: csvExport.filename,
      filters: this.parseStoredFilters(csvExport.filters),
      rowCount: csvExport.rowCount,
      status
    };
  }

  private buildDownloadUrl(csvExport: CsvExportRecord): string {
    const token = this.signDownloadToken(csvExport.userId, csvExport.id, csvExport.expiresAt);

    return `/exports/${csvExport.id}/download?token=${encodeURIComponent(token)}`;
  }

  private signDownloadToken(userId: string, exportId: string, expiresAt: Date): string {
    const payload: SignedDownloadPayload = {
      exp: Math.floor(expiresAt.getTime() / 1000),
      exportId,
      purpose: downloadTokenPurpose,
      userId
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = this.sign(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  private verifyDownloadToken(
    token: string,
    userId: string,
    exportId: string,
    now: Date
  ): void {
    const [encodedPayload, signature, extra] = token.split(".");

    if (
      encodedPayload === undefined ||
      signature === undefined ||
      extra !== undefined ||
      !this.isValidSignature(encodedPayload, signature)
    ) {
      throw new BadRequestException("Invalid download token");
    }

    let payload: SignedDownloadPayload;

    try {
      payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SignedDownloadPayload;
    } catch {
      throw new BadRequestException("Invalid download token");
    }

    if (
      payload.purpose !== downloadTokenPurpose ||
      payload.userId !== userId ||
      payload.exportId !== exportId ||
      typeof payload.exp !== "number"
    ) {
      throw new BadRequestException("Invalid download token");
    }

    if (payload.exp * 1000 <= now.getTime()) {
      throw new BadRequestException("Download token has expired");
    }
  }

  private sign(encodedPayload: string): string {
    return createHmac("sha256", this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"))
      .update(encodedPayload)
      .digest("base64url");
  }

  private isValidSignature(encodedPayload: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(encodedPayload), "utf8");
    const actual = Buffer.from(signature, "utf8");

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private buildFilename(filters: CsvExportFilters, now: Date): string {
    const datePart = now.toISOString().slice(0, 10);
    const fromPart = filters.dateFrom ?? "all";
    const toPart = filters.dateTo ?? "all";

    return `money-tracker-transactions-${fromPart}-to-${toPart}-${datePart}.csv`;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
