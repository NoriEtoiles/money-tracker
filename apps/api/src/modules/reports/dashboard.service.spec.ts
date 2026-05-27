import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { DashboardService } from "./dashboard.service";

type FakeAccount = {
  archivedAt: Date | null;
  currency: string;
  currentBalance: Prisma.Decimal;
  deletedAt: Date | null;
  id: string;
  includeInNetWorth: boolean;
  name: string;
  userId: string;
};

type FakeCategory = {
  id: string;
  name: string;
};

type FakeTransaction = {
  accountId: string;
  amount: Prisma.Decimal;
  categoryId: string | null;
  createdAt: Date;
  currency: string;
  deletedAt: Date | null;
  id: string;
  isDeleted: boolean;
  merchant: string | null;
  note: string | null;
  status: string;
  transactionAt: Date;
  transferGroupId: string | null;
  transferSide: string | null;
  type: string;
  userId: string;
};

type FakeBudget = {
  amount: Prisma.Decimal;
  categoryId: string;
  createdAt: Date;
  currency: string;
  id: string;
  periodEnd: Date;
  periodStart: Date;
  status: string;
  thresholdPercentage: Prisma.Decimal;
  updatedAt: Date;
  userId: string;
};

type FakeBudgetWithCategory = FakeBudget & {
  category: FakeCategory;
};

type FilterObject = {
  gte?: unknown;
  in?: unknown[];
  lt?: unknown;
  not?: unknown;
};

class FakePrismaService {
  readonly accounts = new Map<string, FakeAccount>();
  readonly budgets = new Map<string, FakeBudget>();
  readonly categories = new Map<string, FakeCategory>();
  readonly transactions = new Map<string, FakeTransaction>();

  readonly account = {
    findMany: async (input: { where: Record<string, unknown> }): Promise<FakeAccount[]> =>
      [...this.accounts.values()].filter((account) => matchesWhere(account, input.where))
  };

  readonly budget = {
    findMany: async (input: { where: Record<string, unknown> }): Promise<FakeBudgetWithCategory[]> =>
      [...this.budgets.values()]
        .filter((budget) => matchesWhere(budget, input.where))
        .sort((left, right) => {
          const leftName = this.categories.get(left.categoryId)?.name ?? "";
          const rightName = this.categories.get(right.categoryId)?.name ?? "";
          const nameDifference = leftName.localeCompare(rightName);

          return nameDifference !== 0
            ? nameDifference
            : left.createdAt.getTime() - right.createdAt.getTime();
        })
        .map((budget) => this.withBudgetCategory(budget))
  };

  readonly transaction = {
    aggregate: async (input: {
      where: Record<string, unknown>;
    }): Promise<{ _sum: { amount: Prisma.Decimal | null } }> => {
      const total = [...this.transactions.values()]
        .filter((transaction) => matchesWhere(transaction, input.where))
        .reduce((sum, transaction) => sum.plus(transaction.amount), new Prisma.Decimal(0));

      return {
        _sum: {
          amount: total
        }
      };
    },
    findMany: async (input: {
      take?: number;
      where: Record<string, unknown>;
    }): Promise<Array<Omit<FakeTransaction, "note"> & {
      account: { id: string; name: string };
      category: FakeCategory | null;
    }>> =>
      [...this.transactions.values()]
        .filter((transaction) => matchesWhere(transaction, input.where))
        .sort((left, right) => {
          const dateDifference = right.transactionAt.getTime() - left.transactionAt.getTime();

          return dateDifference !== 0
            ? dateDifference
            : right.createdAt.getTime() - left.createdAt.getTime();
        })
        .slice(0, input.take)
        .map((transaction) => this.withTransactionRelations(transaction)),
    groupBy: async (input: {
      where: Record<string, unknown>;
    }): Promise<Array<{
      _sum: {
        amount: Prisma.Decimal | null;
      };
      currency: string;
      type: string;
    }>> => {
      const grouped = new Map<string, {
        amount: Prisma.Decimal;
        currency: string;
        type: string;
      }>();

      [...this.transactions.values()]
        .filter((transaction) => matchesWhere(transaction, input.where))
        .forEach((transaction) => {
          const key = `${transaction.currency}:${transaction.type}`;
          const existing = grouped.get(key) ?? {
            amount: new Prisma.Decimal(0),
            currency: transaction.currency,
            type: transaction.type
          };

          existing.amount = existing.amount.plus(transaction.amount);
          grouped.set(key, existing);
        });

      return [...grouped.values()].map((group) => ({
        _sum: {
          amount: group.amount
        },
        currency: group.currency,
        type: group.type
      }));
    }
  };

  private withBudgetCategory(budget: FakeBudget): FakeBudgetWithCategory {
    const category = this.categories.get(budget.categoryId);

    if (category === undefined) {
      throw new Error("Fake category not found");
    }

    return {
      ...budget,
      category
    };
  }

  private withTransactionRelations(
    transaction: FakeTransaction
  ): Omit<FakeTransaction, "note"> & {
    account: { id: string; name: string };
    category: FakeCategory | null;
  } {
    const account = this.accounts.get(transaction.accountId);

    if (account === undefined) {
      throw new Error("Fake account not found");
    }

    return {
      accountId: transaction.accountId,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      createdAt: transaction.createdAt,
      currency: transaction.currency,
      deletedAt: transaction.deletedAt,
      id: transaction.id,
      isDeleted: transaction.isDeleted,
      merchant: transaction.merchant,
      status: transaction.status,
      transactionAt: transaction.transactionAt,
      transferGroupId: transaction.transferGroupId,
      transferSide: transaction.transferSide,
      type: transaction.type,
      userId: transaction.userId,
      account: {
        id: account.id,
        name: account.name
      },
      category: transaction.categoryId === null
        ? null
        : this.categories.get(transaction.categoryId) ?? null
    };
  }
}

describe("DashboardService", () => {
  let prisma: FakePrismaService;
  let service: DashboardService;

  beforeEach(() => {
    prisma = new FakePrismaService();
    service = new DashboardService(prisma as unknown as PrismaService);

    seedCategory(prisma, "category-food", "Food");
    seedCategory(prisma, "category-salary", "Salary");
    seedAccount(prisma, {
      currentBalance: "1000.00",
      id: "account-cash",
      name: "Cash",
      userId: "user-1"
    });
    seedAccount(prisma, {
      currentBalance: "200.00",
      id: "account-bank",
      name: "Bank",
      userId: "user-1"
    });
    seedAccount(prisma, {
      currency: "USD",
      currentBalance: "50.00",
      id: "account-usd",
      name: "USD Wallet",
      userId: "user-1"
    });
    seedAccount(prisma, {
      currentBalance: "999.00",
      id: "account-hidden",
      includeInNetWorth: false,
      name: "Hidden",
      userId: "user-1"
    });
    seedAccount(prisma, {
      archivedAt: new Date("2026-05-10T00:00:00.000Z"),
      currentBalance: "999.00",
      id: "account-archived",
      name: "Archived",
      userId: "user-1"
    });
    seedAccount(prisma, {
      currentBalance: "999.00",
      id: "account-other",
      name: "Other",
      userId: "user-2"
    });
  });

  it("returns per-currency summaries with deleted, transfer, and other-user rows excluded", async () => {
    seedTransaction(prisma, {
      amount: "500.00",
      categoryId: "category-salary",
      id: "transaction-income",
      merchant: "Client",
      transactionAt: "2026-05-05T00:00:00.000Z",
      type: "income"
    });
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      id: "transaction-expense",
      merchant: "Food",
      transactionAt: "2026-05-06T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "25.00",
      accountId: "account-usd",
      categoryId: "category-food",
      currency: "USD",
      id: "transaction-usd-expense",
      merchant: "USD Food",
      transactionAt: "2026-05-07T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      id: "transaction-deleted-at",
      isDeleted: false,
      deletedAt: new Date("2026-05-08T00:00:00.000Z"),
      transactionAt: "2026-05-08T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      id: "transaction-soft-deleted",
      isDeleted: true,
      transactionAt: "2026-05-08T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: null,
      id: "transaction-transfer",
      transactionAt: "2026-05-09T00:00:00.000Z",
      transferGroupId: "transfer-group-1",
      transferSide: "outflow",
      type: "transfer"
    });
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      id: "transaction-other-user",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense",
      userId: "user-2"
    });
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      id: "transaction-next-month",
      transactionAt: "2026-06-01T00:00:00.000Z",
      type: "expense"
    });

    const dashboard = await service.getDashboard("user-1", {
      periodStart: "2026-05-01"
    });

    expect(dashboard.periodStart).toBe("2026-05-01");
    expect(dashboard.periodEnd).toBe("2026-06-01");
    expect(dashboard.summaryByCurrency).toEqual([
      {
        currency: "IDR",
        monthlyExpense: "100.0000",
        monthlyIncome: "500.0000",
        netCashflow: "400.0000",
        totalBalance: "1200.0000"
      },
      {
        currency: "USD",
        monthlyExpense: "25.0000",
        monthlyIncome: "0.0000",
        netCashflow: "-25.0000",
        totalBalance: "50.0000"
      }
    ]);
  });

  it("returns budget warnings using Step 8 spent calculation rules", async () => {
    seedBudget(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      id: "budget-food",
      thresholdPercentage: "80.00"
    });
    seedBudget(prisma, {
      amount: "500.00",
      categoryId: "category-food",
      id: "budget-next-month",
      periodEnd: "2026-07-01",
      periodStart: "2026-06-01",
      thresholdPercentage: "80.00"
    });
    seedTransaction(prisma, {
      amount: "80.00",
      categoryId: "category-food",
      id: "transaction-expense",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "30.00",
      categoryId: "category-food",
      id: "transaction-income",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "income"
    });
    seedTransaction(prisma, {
      amount: "30.00",
      categoryId: "category-food",
      id: "transaction-deleted",
      isDeleted: true,
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "30.00",
      categoryId: null,
      id: "transaction-transfer",
      transactionAt: "2026-05-10T00:00:00.000Z",
      transferGroupId: "transfer-group-1",
      transferSide: "outflow",
      type: "transfer"
    });
    seedTransaction(prisma, {
      amount: "30.00",
      categoryId: "category-food",
      id: "transaction-usd",
      currency: "USD",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense"
    });

    const dashboard = await service.getDashboard("user-1", {
      periodStart: "2026-05-01"
    });

    expect(dashboard.budgetSummary.activeBudgetCount).toBe(1);
    expect(dashboard.budgetSummary.thresholdExceededCount).toBe(1);
    expect(dashboard.budgetSummary.warnings).toEqual([
      {
        amount: "100.0000",
        budgetId: "budget-food",
        category: {
          id: "category-food",
          name: "Food"
        },
        currency: "IDR",
        isThresholdExceeded: true,
        remainingAmount: "20.0000",
        spentAmount: "80.0000",
        spentPercentage: "80.00",
        thresholdPercentage: "80.00"
      }
    ]);
  });

  it("limits recent transactions, sorts them newest first, and omits notes", async () => {
    seedTransaction(prisma, {
      amount: "10.00",
      categoryId: "category-food",
      id: "transaction-old",
      merchant: "Old",
      note: "private old note",
      transactionAt: "2026-05-01T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "20.00",
      categoryId: "category-food",
      id: "transaction-new",
      merchant: "New",
      note: "private new note",
      transactionAt: "2026-05-02T00:00:00.000Z",
      type: "expense"
    });
    seedTransaction(prisma, {
      amount: "30.00",
      categoryId: null,
      id: "transaction-transfer",
      transactionAt: "2026-05-03T00:00:00.000Z",
      transferGroupId: "transfer-group-1",
      transferSide: "outflow",
      type: "transfer"
    });
    seedTransaction(prisma, {
      amount: "40.00",
      categoryId: "category-food",
      id: "transaction-next-month",
      merchant: "Next Month",
      transactionAt: "2026-06-01T00:00:00.000Z",
      type: "expense"
    });

    const dashboard = await service.getDashboard("user-1", {
      periodStart: "2026-05-01",
      recentLimit: 5
    });

    expect(dashboard.recentTransactions).toHaveLength(2);
    expect(dashboard.recentTransactions[0]?.id).toBe("transaction-new");
    expect(dashboard.recentTransactions[0]?.merchant).toBe("New");
    expect(Object.hasOwn(dashboard.recentTransactions[0] ?? {}, "note")).toBe(false);
    expect(dashboard.recentTransactions.map((transaction) => transaction.id)).not.toContain(
      "transaction-next-month"
    );
  });

  it("rejects periodStart values that are not the first day of a month", async () => {
    await expect(service.getDashboard("user-1", {
      periodStart: "2026-05-02"
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});

function seedAccount(
  prisma: FakePrismaService,
  input: {
    archivedAt?: Date | null;
    currency?: string;
    currentBalance: string;
    deletedAt?: Date | null;
    id: string;
    includeInNetWorth?: boolean;
    name: string;
    userId: string;
  }
): void {
  prisma.accounts.set(input.id, {
    archivedAt: input.archivedAt ?? null,
    currency: input.currency ?? "IDR",
    currentBalance: new Prisma.Decimal(input.currentBalance),
    deletedAt: input.deletedAt ?? null,
    id: input.id,
    includeInNetWorth: input.includeInNetWorth ?? true,
    name: input.name,
    userId: input.userId
  });
}

function seedBudget(
  prisma: FakePrismaService,
  input: {
    amount: string;
    categoryId: string;
    currency?: string;
    id: string;
    periodEnd?: string;
    periodStart?: string;
    status?: string;
    thresholdPercentage: string;
    userId?: string;
  }
): void {
  prisma.budgets.set(input.id, {
    amount: new Prisma.Decimal(input.amount),
    categoryId: input.categoryId,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    currency: input.currency ?? "IDR",
    id: input.id,
    periodEnd: new Date(`${input.periodEnd ?? "2026-06-01"}T00:00:00.000Z`),
    periodStart: new Date(`${input.periodStart ?? "2026-05-01"}T00:00:00.000Z`),
    status: input.status ?? "active",
    thresholdPercentage: new Prisma.Decimal(input.thresholdPercentage),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    userId: input.userId ?? "user-1"
  });
}

function seedCategory(
  prisma: FakePrismaService,
  id: string,
  name: string
): void {
  prisma.categories.set(id, {
    id,
    name
  });
}

function seedTransaction(
  prisma: FakePrismaService,
  input: {
    accountId?: string;
    amount: string;
    categoryId: string | null;
    createdAt?: string;
    currency?: string;
    deletedAt?: Date | null;
    id: string;
    isDeleted?: boolean;
    merchant?: string | null;
    note?: string | null;
    transactionAt: string;
    transferGroupId?: string | null;
    transferSide?: string | null;
    type: string;
    userId?: string;
  }
): void {
  prisma.transactions.set(input.id, {
    accountId: input.accountId ?? "account-cash",
    amount: new Prisma.Decimal(input.amount),
    categoryId: input.categoryId,
    createdAt: new Date(input.createdAt ?? input.transactionAt),
    currency: input.currency ?? "IDR",
    deletedAt: input.deletedAt ?? null,
    id: input.id,
    isDeleted: input.isDeleted ?? false,
    merchant: input.merchant ?? null,
    note: input.note ?? null,
    status: "posted",
    transactionAt: new Date(input.transactionAt),
    transferGroupId: input.transferGroupId ?? null,
    transferSide: input.transferSide ?? null,
    type: input.type,
    userId: input.userId ?? "user-1"
  });
}

function matchesWhere<TRecord extends Record<string, unknown>>(
  record: TRecord,
  where: Record<string, unknown>
): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) {
      return true;
    }

    const recordValue = record[key];

    if (isFilterObject(value)) {
      if ("in" in value && value.in !== undefined && !value.in.includes(recordValue)) {
        return false;
      }

      if ("not" in value && value.not !== undefined && compareValues(recordValue, value.not) === 0) {
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
