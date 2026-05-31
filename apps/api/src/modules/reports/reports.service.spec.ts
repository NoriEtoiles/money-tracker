import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { ReportsService } from "./reports.service";

type FakeCategory = {
  id: string;
  name: string;
};

type FakeTransaction = {
  amount: Prisma.Decimal;
  category: FakeCategory | null;
  currency: string;
  deletedAt: Date | null;
  id: string;
  isDeleted: boolean;
  transactionAt: Date;
  transferGroupId: string | null;
  transferSide: string | null;
  type: string;
  userId: string;
};

type FakeAccount = {
  archivedAt: Date | null;
  createdAt: Date;
  currentBalance: Prisma.Decimal;
  currency: string;
  deletedAt: Date | null;
  id: string;
  includeInNetWorth: boolean;
  name: string;
  sortOrder: number;
  type: string;
  userId: string;
};

type FilterObject = {
  gte?: unknown;
  in?: unknown[];
  lt?: unknown;
};

class FakePrismaService {
  readonly accounts = new Map<string, FakeAccount>();
  readonly transactions = new Map<string, FakeTransaction>();

  readonly account = {
    findMany: async (input: { where: Record<string, unknown> }): Promise<FakeAccount[]> =>
      [...this.accounts.values()].filter((account) => matchesWhere(account, input.where))
  };

  readonly transaction = {
    findMany: async (input: { where: Record<string, unknown> }): Promise<FakeTransaction[]> =>
      [...this.transactions.values()].filter((transaction) =>
        matchesWhere(transaction, input.where)
      )
  };
}

describe("ReportsService", () => {
  let prisma: FakePrismaService;
  let service: ReportsService;

  beforeEach(() => {
    prisma = new FakePrismaService();
    service = new ReportsService(prisma as unknown as PrismaService);
  });

  it("returns spending by category with inclusive UTC date bounds and report exclusions", async () => {
    seedTransaction(prisma, {
      amount: "100.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      id: "transaction-date-from",
      transactionAt: "2026-05-01T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "50.00",
      category: {
        id: "category-transport",
        name: "Transport"
      },
      id: "transaction-date-to",
      transactionAt: "2026-05-31T23:59:59.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "50.00",
      category: null,
      id: "transaction-uncategorized",
      transactionAt: "2026-05-12T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "40.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      currency: "USD",
      id: "transaction-usd",
      transactionAt: "2026-05-12T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "999.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      id: "transaction-other-user",
      transactionAt: "2026-05-12T00:00:00.000Z",
      type: "expense",
      userId: "user-2"
    });
    seedTransaction(prisma, {
      amount: "999.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      deletedAt: new Date("2026-05-20T00:00:00.000Z"),
      id: "transaction-deleted-at",
      transactionAt: "2026-05-12T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "999.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      id: "transaction-soft-deleted",
      isDeleted: true,
      transactionAt: "2026-05-12T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "999.00",
      category: null,
      id: "transaction-transfer-type",
      transactionAt: "2026-05-12T00:00:00.000Z",
      transferGroupId: "transfer-group-1",
      transferSide: "outflow",
      type: "transfer"
    });
    seedTransaction(prisma, {
      amount: "999.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      id: "transaction-transfer-shaped-expense",
      transactionAt: "2026-05-12T00:00:00.000Z",
      transferGroupId: "transfer-group-2",
      transferSide: "outflow",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "999.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      id: "transaction-next-day",
      transactionAt: "2026-06-01T00:00:00.000Z",
      type: "expense"
    });

    const report = await service.getSpendingReport("user-1", {
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31"
    });

    expect(report).toEqual({
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
      items: [
        {
          amount: "100.0000",
          category: {
            id: "category-food",
            name: "Food"
          },
          currency: "IDR",
          percentage: "50.00"
        },
        {
          amount: "50.0000",
          category: {
            id: "category-transport",
            name: "Transport"
          },
          currency: "IDR",
          percentage: "25.00"
        },
        {
          amount: "50.0000",
          category: null,
          currency: "IDR",
          percentage: "25.00"
        },
        {
          amount: "40.0000",
          category: {
            id: "category-food",
            name: "Food"
          },
          currency: "USD",
          percentage: "100.00"
        }
      ],
      totalsByCurrency: [
        {
          currency: "IDR",
          totalAmount: "200.0000"
        },
        {
          currency: "USD",
          totalAmount: "40.0000"
        }
      ]
    });
  });

  it("returns monthly cashflow buckets sorted by period and currency", async () => {
    seedTransaction(prisma, {
      amount: "500.00",
      category: {
        id: "category-salary",
        name: "Salary"
      },
      id: "transaction-may-income",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "income"
    });
    seedTransaction(prisma, {
      amount: "100.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      id: "transaction-may-expense",
      transactionAt: "2026-05-11T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "25.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      id: "transaction-june-expense",
      transactionAt: "2026-06-05T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "80.00",
      category: {
        id: "category-salary",
        name: "Salary"
      },
      currency: "USD",
      id: "transaction-june-usd-income",
      transactionAt: "2026-06-06T00:00:00.000Z",
      type: "income"
    });
    seedTransaction(prisma, {
      amount: "999.00",
      category: null,
      id: "transaction-transfer",
      transactionAt: "2026-05-11T00:00:00.000Z",
      transferGroupId: "transfer-group-1",
      transferSide: "inflow",
      type: "transfer"
    });
    seedTransaction(prisma, {
      amount: "999.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      id: "transaction-out-of-range",
      transactionAt: "2026-07-01T00:00:00.000Z",
      type: "expense"
    });

    const report = await service.getCashflowReport("user-1", {
      dateFrom: "2026-05-01",
      dateTo: "2026-06-30"
    });

    expect(report).toEqual({
      buckets: [
        {
          currency: "IDR",
          expenseAmount: "100.0000",
          incomeAmount: "500.0000",
          netCashflow: "400.0000",
          periodEnd: "2026-06-01",
          periodStart: "2026-05-01"
        },
        {
          currency: "IDR",
          expenseAmount: "25.0000",
          incomeAmount: "0.0000",
          netCashflow: "-25.0000",
          periodEnd: "2026-07-01",
          periodStart: "2026-06-01"
        },
        {
          currency: "USD",
          expenseAmount: "0.0000",
          incomeAmount: "80.0000",
          netCashflow: "80.0000",
          periodEnd: "2026-07-01",
          periodStart: "2026-06-01"
        }
      ],
      dateFrom: "2026-05-01",
      dateTo: "2026-06-30",
      grain: "month"
    });
  });

  it("returns net worth from active included accounts with stable account sorting", async () => {
    seedAccount(prisma, {
      currentBalance: "100.00",
      id: "account-cash",
      name: "Cash",
      sortOrder: 20
    });
    seedAccount(prisma, {
      currentBalance: "200.00",
      id: "account-wallet",
      name: "Wallet",
      sortOrder: 10
    });
    seedAccount(prisma, {
      createdAt: "2026-05-01T00:00:02.000Z",
      currentBalance: "25.00",
      currency: "USD",
      id: "account-usd-b",
      name: "Brokerage",
      sortOrder: 1
    });
    seedAccount(prisma, {
      createdAt: "2026-05-01T00:00:01.000Z",
      currentBalance: "50.00",
      currency: "USD",
      id: "account-usd-bank",
      name: "Bank",
      sortOrder: 1
    });
    seedAccount(prisma, {
      currentBalance: "999.00",
      id: "account-hidden",
      includeInNetWorth: false,
      name: "Hidden"
    });
    seedAccount(prisma, {
      archivedAt: new Date("2026-05-01T00:00:00.000Z"),
      currentBalance: "999.00",
      id: "account-archived",
      name: "Archived"
    });
    seedAccount(prisma, {
      currentBalance: "999.00",
      deletedAt: new Date("2026-05-01T00:00:00.000Z"),
      id: "account-deleted",
      name: "Deleted"
    });
    seedAccount(prisma, {
      currentBalance: "999.00",
      id: "account-other-user",
      name: "Other",
      userId: "user-2"
    });

    const report = await service.getNetWorthReport("user-1", {});

    expect(report.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.summaryByCurrency).toEqual([
      {
        accountCount: 2,
        currency: "IDR",
        totalBalance: "300.0000"
      },
      {
        accountCount: 2,
        currency: "USD",
        totalBalance: "75.0000"
      }
    ]);
    expect(report.accounts.map((account) => account.id)).toEqual([
      "account-wallet",
      "account-cash",
      "account-usd-bank",
      "account-usd-b"
    ]);
  });

  it("applies currency filters without combining currencies", async () => {
    seedTransaction(prisma, {
      amount: "100.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      id: "transaction-idr",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "50.00",
      category: {
        id: "category-food",
        name: "Food"
      },
      currency: "USD",
      id: "transaction-usd",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense"
    });
    seedAccount(prisma, {
      currentBalance: "100.00",
      id: "account-idr",
      name: "Cash"
    });
    seedAccount(prisma, {
      currentBalance: "50.00",
      currency: "USD",
      id: "account-usd",
      name: "USD"
    });

    const spending = await service.getSpendingReport("user-1", {
      currency: "USD",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31"
    });
    const netWorth = await service.getNetWorthReport("user-1", {
      currency: "USD"
    });

    expect(spending.totalsByCurrency).toEqual([
      {
        currency: "USD",
        totalAmount: "50.0000"
      }
    ]);
    expect(netWorth.summaryByCurrency).toEqual([
      {
        accountCount: 1,
        currency: "USD",
        totalBalance: "50.0000"
      }
    ]);
  });

  it("rejects invalid and reversed date ranges", async () => {
    await expect(service.getSpendingReport("user-1", {
      dateFrom: "2026-02-31",
      dateTo: "2026-03-01"
    })).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.getCashflowReport("user-1", {
      dateFrom: "2026-06-01",
      dateTo: "2026-05-31"
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});

function seedAccount(
  prisma: FakePrismaService,
  input: {
    archivedAt?: Date | null;
    createdAt?: string;
    currency?: string;
    currentBalance: string;
    deletedAt?: Date | null;
    id: string;
    includeInNetWorth?: boolean;
    name: string;
    sortOrder?: number;
    type?: string;
    userId?: string;
  }
): void {
  prisma.accounts.set(input.id, {
    archivedAt: input.archivedAt ?? null,
    createdAt: new Date(input.createdAt ?? "2026-05-01T00:00:00.000Z"),
    currency: input.currency ?? "IDR",
    currentBalance: new Prisma.Decimal(input.currentBalance),
    deletedAt: input.deletedAt ?? null,
    id: input.id,
    includeInNetWorth: input.includeInNetWorth ?? true,
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
    type: input.type ?? "cash",
    userId: input.userId ?? "user-1"
  });
}

function seedTransaction(
  prisma: FakePrismaService,
  input: {
    amount: string;
    category: FakeCategory | null;
    currency?: string;
    deletedAt?: Date | null;
    id: string;
    isDeleted?: boolean;
    transactionAt: string;
    transferGroupId?: string | null;
    transferSide?: string | null;
    type: string;
    userId?: string;
  }
): void {
  prisma.transactions.set(input.id, {
    amount: new Prisma.Decimal(input.amount),
    category: input.category,
    currency: input.currency ?? "IDR",
    deletedAt: input.deletedAt ?? null,
    id: input.id,
    isDeleted: input.isDeleted ?? false,
    transactionAt: new Date(input.transactionAt),
    transferGroupId: input.transferGroupId ?? null,
    transferSide: input.transferSide ?? null,
    type: input.type,
    userId: input.userId ?? "user-1"
  });
}

function matchesWhere(record: object, where: Record<string, unknown>): boolean {
  const recordObject = record as Record<string, unknown>;

  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) {
      return true;
    }

    const recordValue = recordObject[key];

    if (isFilterObject(value)) {
      if ("in" in value && value.in !== undefined && !value.in.includes(recordValue)) {
        return false;
      }

      if ("gte" in value && value.gte !== undefined && compareValues(recordValue, value.gte) < 0) {
        return false;
      }

      if ("lt" in value && value.lt !== undefined && compareValues(recordValue, value.lt) >= 0) {
        return false;
      }

      return true;
    }

    return compareValues(recordValue, value) === 0;
  });
}

function isFilterObject(value: unknown): value is FilterObject {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date);
}

function compareValues(left: unknown, right: unknown): number {
  if (left instanceof Prisma.Decimal && right instanceof Prisma.Decimal) {
    return left.comparedTo(right);
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }

  if (left === right) {
    return 0;
  }

  return String(left).localeCompare(String(right));
}
