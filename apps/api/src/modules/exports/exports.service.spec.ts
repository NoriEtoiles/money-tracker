import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateCsvExportDto } from "./dto/create-csv-export.dto";
import { ExportsService } from "./exports.service";

type FakeAccount = {
  deletedAt: Date | null;
  id: string;
  name: string;
  type: string;
  userId: string;
};

type FakeCategory = {
  id: string;
  name: string;
};

type FakeTransaction = {
  account: FakeAccount;
  accountId: string;
  amount: Prisma.Decimal;
  category: FakeCategory | null;
  createdAt: Date;
  currency: string;
  deletedAt: Date | null;
  id: string;
  isDeleted: boolean;
  merchant: string | null;
  note: string | null;
  source: string;
  status: string;
  transactionAt: Date;
  transferGroupId: string | null;
  transferSide: string | null;
  type: string;
  userId: string;
};

type FakeCsvExport = {
  completedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
  exportType: string;
  filename: string;
  filters: Prisma.JsonValue;
  id: string;
  rowCount: number | null;
  status: string;
  userId: string;
};

type FakeAuditEvent = {
  entityId?: string;
  entityType?: string;
  eventType: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string;
};

class FakePrismaService {
  private exportCount = 0;

  readonly accounts = new Map<string, FakeAccount>();
  readonly csvExports = new Map<string, FakeCsvExport>();
  readonly transactions = new Map<string, FakeTransaction>();

  readonly account = {
    findFirst: async (input: {
      select: { id: true };
      where: { deletedAt: Date | null; id: string; userId: string };
    }): Promise<{ id: string } | null> => {
      const account = this.accounts.get(input.where.id);

      return account !== undefined &&
        account.deletedAt === input.where.deletedAt &&
        account.userId === input.where.userId
        ? { id: account.id }
        : null;
    }
  };

  readonly csvExport = {
    create: async (input: {
      data: {
        expiresAt: Date;
        exportType: string;
        filename: string;
        filters: Prisma.InputJsonValue;
        status: string;
        userId: string;
      };
    }): Promise<FakeCsvExport> => {
      this.exportCount += 1;
      const csvExport: FakeCsvExport = {
        ...input.data,
        completedAt: null,
        createdAt: new Date("2026-06-03T00:00:00.000Z"),
        filters: input.data.filters as unknown as Prisma.JsonValue,
        id: `export-${this.exportCount}`,
        rowCount: null
      };

      this.csvExports.set(csvExport.id, csvExport);

      return csvExport;
    },
    findFirst: async (input: {
      where: { id: string; userId: string };
    }): Promise<FakeCsvExport | null> => {
      const csvExport = this.csvExports.get(input.where.id);

      return csvExport !== undefined && csvExport.userId === input.where.userId
        ? csvExport
        : null;
    },
    findMany: async (input: {
      skip?: number;
      take?: number;
      where: { userId: string };
    }): Promise<FakeCsvExport[]> => {
      const skip = input.skip ?? 0;
      const take = input.take ?? this.csvExports.size;

      return [...this.csvExports.values()]
        .filter((csvExport) => csvExport.userId === input.where.userId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(skip, skip + take);
    },
    update: async (input: {
      data: Partial<Pick<FakeCsvExport, "completedAt" | "rowCount" | "status">>;
      where: { id: string };
    }): Promise<FakeCsvExport> => {
      const csvExport = this.csvExports.get(input.where.id);

      if (csvExport === undefined) {
        throw new Error("Fake export not found");
      }

      Object.assign(csvExport, input.data);

      return csvExport;
    },
    updateMany: async (input: {
      data: { status: string };
      where: {
        expiresAt: { lte: Date };
        status: { not: string };
        userId: string;
      };
    }): Promise<{ count: number }> => {
      let count = 0;

      this.csvExports.forEach((csvExport) => {
        if (
          csvExport.userId === input.where.userId &&
          csvExport.status !== input.where.status.not &&
          csvExport.expiresAt.getTime() <= input.where.expiresAt.lte.getTime()
        ) {
          csvExport.status = input.data.status;
          count += 1;
        }
      });

      return { count };
    }
  };

  readonly transaction = {
    findMany: async (input: {
      include: unknown;
      orderBy: unknown;
      where: {
        account: { deletedAt: Date | null; userId: string };
        accountId?: string;
        currency?: string;
        deletedAt: Date | null;
        isDeleted: boolean;
        transactionAt: { gte?: Date; lt?: Date };
        type?: string;
        userId: string;
      };
    }): Promise<FakeTransaction[]> =>
      [...this.transactions.values()]
        .filter((transaction) => matchesTransaction(transaction, input.where))
        .sort(compareTransactions)
  };
}

class FakeAuditService {
  readonly auditEvents: FakeAuditEvent[] = [];

  async record(input: FakeAuditEvent): Promise<void> {
    this.auditEvents.push(input);
  }
}

class FakeConfigService {
  getOrThrow(key: string): string {
    if (key !== "JWT_ACCESS_SECRET") {
      throw new Error(`Unexpected config key ${key}`);
    }

    return "0123456789abcdef0123456789abcdef";
  }
}

describe("ExportsService", () => {
  let auditService: FakeAuditService;
  let prisma: FakePrismaService;
  let service: ExportsService;

  beforeEach(() => {
    auditService = new FakeAuditService();
    prisma = new FakePrismaService();
    service = new ExportsService(
      auditService as unknown as AuditService,
      new FakeConfigService() as unknown as ConfigService,
      prisma as unknown as PrismaService
    );

    seedAccount(prisma, {
      id: "account-1",
      name: "=Cash",
      type: "cash",
      userId: "user-1"
    });
    seedAccount(prisma, {
      id: "account-2",
      name: "USD Wallet",
      type: "wallet",
      userId: "user-1"
    });
    seedAccount(prisma, {
      deletedAt: new Date("2026-06-01T00:00:00.000Z"),
      id: "account-deleted",
      name: "Deleted",
      type: "cash",
      userId: "user-1"
    });
    seedAccount(prisma, {
      id: "account-other",
      name: "Other",
      type: "cash",
      userId: "user-2"
    });
  });

  it("generates CSV with stable headers, decimal strings, transfer rows, safe text, and source labels", async () => {
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "10.5",
      category: {
        id: "category-food",
        name: "+Food"
      },
      id: "transaction-expense",
      merchant: "-Shop",
      note: "@note",
      source: "manual",
      transactionAt: "2026-06-10T01:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "25",
      category: null,
      id: "transaction-transfer-out",
      source: "manual",
      transactionAt: "2026-06-11T01:00:00.000Z",
      transferGroupId: "transfer-group-1",
      transferSide: "outflow",
      type: "transfer"
    });
    seedTransaction(prisma, {
      accountId: "account-2",
      amount: "25",
      category: null,
      id: "transaction-transfer-in",
      source: "manual",
      transactionAt: "2026-06-11T01:00:00.000Z",
      transferGroupId: "transfer-group-1",
      transferSide: "inflow",
      type: "transfer"
    });
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "100",
      category: {
        id: "category-salary",
        name: "Salary"
      },
      id: "transaction-recurring",
      source: "recurring",
      transactionAt: "2026-06-12T01:00:00.000Z",
      type: "income"
    });
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "11",
      category: null,
      id: "transaction-imported",
      merchant: "Imported",
      source: "import",
      transactionAt: "2026-06-13T01:00:00.000Z",
      type: "expense"
    });

    const created = await service.createExport("user-1", exportInput());
    const download = await service.downloadExport(
      "user-1",
      created.exportId,
      tokenFrom(created.downloadUrl)
    );

    expect(download.rowCount).toBe(5);
    expect(download.contents).toContain(
      "transaction_id,transaction_at,transaction_type,amount,currency,account_id,account_name,account_type,category_id,category_name,merchant,note,status,source,transfer_group_id,transfer_side"
    );
    expect(download.contents).toContain("transaction-expense,2026-06-10T01:00:00.000Z,expense,10.5000,IDR,account-1,'=Cash,cash,category-food,'+Food,'-Shop,'@note,posted,manual,,");
    expect(download.contents).toContain("transaction-transfer-out");
    expect(download.contents).toContain("transfer-group-1,outflow");
    expect(download.contents).toContain("transaction-recurring");
    expect(download.contents).toContain(",recurring,,");
    expect(download.contents).toContain("transaction-imported");
    expect(download.contents).toContain(",import,,");
  });

  it("escapes quotes, commas, and newlines without changing numeric and date fields", async () => {
    const account = prisma.accounts.get("account-1");

    if (account === undefined) {
      throw new Error("Seeded account missing");
    }

    account.name = "Cash, Primary";
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "12.3456",
      category: {
        id: "category-food",
        name: "Food"
      },
      id: "transaction-escaped",
      merchant: "Warung \"A\"",
      note: "Line 1\nLine 2",
      transactionAt: "2026-06-10T01:00:00.000Z",
      type: "expense"
    });

    const created = await service.createExport("user-1", exportInput());
    const download = await service.downloadExport(
      "user-1",
      created.exportId,
      tokenFrom(created.downloadUrl)
    );

    expect(download.contents).toContain("2026-06-10T01:00:00.000Z,expense,12.3456");
    expect(download.contents).toContain("\"Cash, Primary\"");
    expect(download.contents).toContain("\"Warung \"\"A\"\"\"");
    expect(download.contents).toContain("\"Line 1\nLine 2\"");
  });

  it("applies date, account, currency, and transactionType filters", async () => {
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "99",
      id: "transaction-before",
      transactionAt: "2026-05-31T23:59:59.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "100",
      id: "transaction-date-to",
      transactionAt: "2026-06-30T23:59:59.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "101",
      id: "transaction-next-day",
      transactionAt: "2026-07-01T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      accountId: "account-2",
      amount: "102",
      currency: "USD",
      id: "transaction-usd",
      transactionAt: "2026-06-10T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "103",
      id: "transaction-income",
      transactionAt: "2026-06-10T00:00:00.000Z",
      type: "income"
    });

    const created = await service.createExport("user-1", {
      accountId: "account-1",
      currency: "IDR",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      exportType: "transactions_csv",
      transactionType: "expense"
    });
    const download = await service.downloadExport(
      "user-1",
      created.exportId,
      tokenFrom(created.downloadUrl)
    );

    expect(download.rowCount).toBe(1);
    expect(download.contents).toContain("transaction-date-to");
    expect(download.contents).not.toContain("transaction-before");
    expect(download.contents).not.toContain("transaction-next-day");
    expect(download.contents).not.toContain("transaction-usd");
    expect(download.contents).not.toContain("transaction-income");
  });

  it("excludes deleted rows, soft-deleted rows, deleted-account rows, and other-user rows", async () => {
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "1",
      id: "transaction-active",
      transactionAt: "2026-06-10T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "2",
      deletedAt: new Date("2026-06-11T00:00:00.000Z"),
      id: "transaction-deleted",
      transactionAt: "2026-06-10T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "3",
      id: "transaction-soft-deleted",
      isDeleted: true,
      transactionAt: "2026-06-10T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      accountId: "account-deleted",
      amount: "4",
      id: "transaction-deleted-account",
      transactionAt: "2026-06-10T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      accountId: "account-other",
      amount: "5",
      id: "transaction-other-user",
      transactionAt: "2026-06-10T00:00:00.000Z",
      type: "expense",
      userId: "user-2"
    });

    const created = await service.createExport("user-1", exportInput());
    const download = await service.downloadExport(
      "user-1",
      created.exportId,
      tokenFrom(created.downloadUrl)
    );

    expect(download.rowCount).toBe(1);
    expect(download.contents).toContain("transaction-active");
    expect(download.contents).not.toContain("transaction-deleted");
    expect(download.contents).not.toContain("transaction-soft-deleted");
    expect(download.contents).not.toContain("transaction-deleted-account");
    expect(download.contents).not.toContain("transaction-other-user");
  });

  it("denies cross-user export status, download, and account filters", async () => {
    const created = await service.createExport("user-1", exportInput());

    await expect(service.getExport("user-2", created.exportId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.downloadExport(
      "user-2",
      created.exportId,
      tokenFrom(created.downloadUrl)
    )).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.createExport("user-1", {
      accountId: "account-other",
      exportType: "transactions_csv"
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects tampered and expired download tokens", async () => {
    const now = new Date("2026-06-03T00:00:00.000Z");
    const created = await service.createExport("user-1", exportInput(), now);
    const token = tokenFrom(created.downloadUrl);
    const tampered = `${token.slice(0, -1)}x`;

    await expect(service.downloadExport(
      "user-1",
      created.exportId,
      tampered,
      now
    )).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.downloadExport(
      "user-1",
      created.exportId,
      token,
      new Date("2026-06-03T00:16:00.000Z")
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it("audits safe request and download metadata without sensitive CSV content or tokens", async () => {
    seedTransaction(prisma, {
      accountId: "account-1",
      amount: "10",
      id: "transaction-sensitive",
      merchant: "Sensitive merchant",
      note: "Sensitive note",
      transactionAt: "2026-06-10T00:00:00.000Z",
      type: "expense"
    });

    const created = await service.createExport("user-1", exportInput());
    await service.downloadExport("user-1", created.exportId, tokenFrom(created.downloadUrl));

    expect(auditService.auditEvents.map((event) => event.eventType)).toEqual([
      "csv_export_request",
      "csv_export_download"
    ]);
    expect(auditService.auditEvents[1]?.metadata).toMatchObject({
      exportType: "transactions_csv",
      rowCount: 1,
      status: "downloaded"
    });
    const serializedAudit = JSON.stringify(auditService.auditEvents);

    expect(serializedAudit).not.toContain("Sensitive merchant");
    expect(serializedAudit).not.toContain("Sensitive note");
    expect(serializedAudit).not.toContain("token");
    expect(serializedAudit).not.toContain("download?token");
  });

  it("rejects reversed date ranges", async () => {
    await expect(service.createExport("user-1", {
      dateFrom: "2026-07-01",
      dateTo: "2026-06-30",
      exportType: "transactions_csv"
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});

function exportInput(): CreateCsvExportDto {
  return {
    dateFrom: "2026-06-01",
    dateTo: "2026-06-30",
    exportType: "transactions_csv"
  };
}

function tokenFrom(downloadUrl: string | null): string {
  if (downloadUrl === null) {
    throw new Error("Expected download URL");
  }

  const token = new URL(`http://localhost${downloadUrl}`).searchParams.get("token");

  if (token === null) {
    throw new Error("Expected token");
  }

  return token;
}

function seedAccount(
  prisma: FakePrismaService,
  input: {
    deletedAt?: Date | null;
    id: string;
    name: string;
    type: string;
    userId: string;
  }
): void {
  prisma.accounts.set(input.id, {
    deletedAt: input.deletedAt ?? null,
    id: input.id,
    name: input.name,
    type: input.type,
    userId: input.userId
  });
}

function seedTransaction(
  prisma: FakePrismaService,
  input: {
    accountId: string;
    amount: string;
    category?: FakeCategory | null;
    currency?: string;
    deletedAt?: Date | null;
    id: string;
    isDeleted?: boolean;
    merchant?: string | null;
    note?: string | null;
    source?: string;
    status?: string;
    transactionAt: string;
    transferGroupId?: string | null;
    transferSide?: string | null;
    type: string;
    userId?: string;
  }
): void {
  const account = prisma.accounts.get(input.accountId);

  if (account === undefined) {
    throw new Error(`Missing fake account ${input.accountId}`);
  }

  prisma.transactions.set(input.id, {
    account,
    accountId: input.accountId,
    amount: new Prisma.Decimal(input.amount),
    category: input.category ?? null,
    createdAt: new Date(input.transactionAt),
    currency: input.currency ?? "IDR",
    deletedAt: input.deletedAt ?? null,
    id: input.id,
    isDeleted: input.isDeleted ?? false,
    merchant: input.merchant ?? null,
    note: input.note ?? null,
    source: input.source ?? "manual",
    status: input.status ?? "posted",
    transactionAt: new Date(input.transactionAt),
    transferGroupId: input.transferGroupId ?? null,
    transferSide: input.transferSide ?? null,
    type: input.type,
    userId: input.userId ?? "user-1"
  });
}

function matchesTransaction(
  transaction: FakeTransaction,
  where: {
    account: { deletedAt: Date | null; userId: string };
    accountId?: string;
    currency?: string;
    deletedAt: Date | null;
    isDeleted: boolean;
    transactionAt: { gte?: Date; lt?: Date };
    type?: string;
    userId: string;
  }
): boolean {
  return transaction.userId === where.userId &&
    transaction.account.userId === where.account.userId &&
    transaction.account.deletedAt === where.account.deletedAt &&
    transaction.deletedAt === where.deletedAt &&
    transaction.isDeleted === where.isDeleted &&
    (where.accountId === undefined || transaction.accountId === where.accountId) &&
    (where.currency === undefined || transaction.currency === where.currency) &&
    (where.type === undefined || transaction.type === where.type) &&
    (where.transactionAt.gte === undefined || transaction.transactionAt.getTime() >= where.transactionAt.gte.getTime()) &&
    (where.transactionAt.lt === undefined || transaction.transactionAt.getTime() < where.transactionAt.lt.getTime());
}

function compareTransactions(left: FakeTransaction, right: FakeTransaction): number {
  const transactionAtDifference = left.transactionAt.getTime() - right.transactionAt.getTime();

  if (transactionAtDifference !== 0) {
    return transactionAtDifference;
  }

  const createdAtDifference = left.createdAt.getTime() - right.createdAt.getTime();

  return createdAtDifference !== 0 ? createdAtDifference : left.id.localeCompare(right.id);
}
