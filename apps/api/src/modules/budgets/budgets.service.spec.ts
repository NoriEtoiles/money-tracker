import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { BudgetsService } from "./budgets.service";

type FakeCategory = {
  archivedAt: Date | null;
  deletedAt: Date | null;
  id: string;
  kind: string;
  name: string;
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

type FakeBudgetResponse = FakeBudget & {
  category: {
    id: string;
    name: string;
  };
};

type FakeTransaction = {
  amount: Prisma.Decimal;
  categoryId: string | null;
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

class FakeTransactionClient {
  private budgetCount = 0;

  readonly budget = {
    create: async (input: {
      data: {
        amount: Prisma.Decimal;
        categoryId: string;
        currency: string;
        periodEnd: Date;
        periodStart: Date;
        thresholdPercentage: Prisma.Decimal;
        userId: string;
      };
    }): Promise<FakeBudgetResponse> => {
      this.budgetCount += 1;
      const budget: FakeBudget = {
        ...input.data,
        createdAt: new Date("2026-05-17T00:00:00.000Z"),
        id: `budget-${this.budgetCount}`,
        status: "active",
        updatedAt: new Date("2026-05-17T00:00:00.000Z")
      };
      this.budgets.set(budget.id, budget);

      return this.withBudgetRelations(budget);
    },
    findFirst: async (input: { where: Partial<FakeBudget> }): Promise<FakeBudgetResponse | null> => {
      const budget = [...this.budgets.values()].find((candidate) =>
        matchesWhere(candidate, input.where)
      );

      return budget === undefined ? null : this.withBudgetRelations(budget);
    },
    findMany: async (input: { where: Partial<FakeBudget> }): Promise<FakeBudgetResponse[]> =>
      [...this.budgets.values()]
        .filter((candidate) => matchesWhere(candidate, input.where))
        .sort((left, right) => {
          const leftName = this.categories.get(left.categoryId)?.name ?? "";
          const rightName = this.categories.get(right.categoryId)?.name ?? "";
          const nameDifference = leftName.localeCompare(rightName);

          return nameDifference !== 0
            ? nameDifference
            : left.createdAt.getTime() - right.createdAt.getTime();
        })
        .map((budget) => this.withBudgetRelations(budget)),
    findUnique: async (input: {
      where: {
        userId_categoryId_periodStart_currency: {
          categoryId: string;
          currency: string;
          periodStart: Date;
          userId: string;
        };
      };
    }): Promise<{ id: string; status: string } | null> => {
      const identity = input.where.userId_categoryId_periodStart_currency;
      const budget = [...this.budgets.values()].find((candidate) =>
        candidate.userId === identity.userId &&
        candidate.categoryId === identity.categoryId &&
        candidate.currency === identity.currency &&
        candidate.periodStart.getTime() === identity.periodStart.getTime()
      );

      return budget === undefined ? null : { id: budget.id, status: budget.status };
    },
    update: async (input: {
      data: Partial<FakeBudget>;
      where: { id: string };
    }): Promise<FakeBudgetResponse> => {
      const budget = this.budgets.get(input.where.id);

      if (budget === undefined) {
        throw new Error("Fake budget not found");
      }

      Object.entries(input.data).forEach(([key, value]) => {
        if (value !== undefined) {
          Object.assign(budget, { [key]: value });
        }
      });
      budget.updatedAt = new Date("2026-05-18T00:00:00.000Z");

      return this.withBudgetRelations(budget);
    }
  };

  readonly category = {
    findFirst: async (input: { where: Partial<FakeCategory> }): Promise<FakeCategory | null> => {
      const category = [...this.categories.values()].find((candidate) =>
        matchesWhere(candidate, input.where)
      );

      return category ?? null;
    }
  };

  readonly transaction = {
    aggregate: async (input: {
      where: Partial<FakeTransaction> & {
        transactionAt?: {
          gte?: Date;
          lt?: Date;
        };
      };
    }): Promise<{ _sum: { amount: Prisma.Decimal | null } }> => {
      const total = [...this.transactions.values()]
        .filter((candidate) => matchesWhere(candidate, input.where))
        .reduce((sum, transaction) => sum.plus(transaction.amount), new Prisma.Decimal(0));

      return {
        _sum: {
          amount: total
        }
      };
    }
  };

  constructor(
    readonly budgets: Map<string, FakeBudget>,
    readonly categories: Map<string, FakeCategory>,
    readonly transactions: Map<string, FakeTransaction>
  ) {}

  private withBudgetRelations(budget: FakeBudget): FakeBudgetResponse {
    const category = this.categories.get(budget.categoryId);

    if (category === undefined) {
      throw new Error("Fake category relation not found");
    }

    return {
      ...budget,
      category: {
        id: category.id,
        name: category.name
      }
    };
  }
}

class FakePrismaService {
  readonly budgets = new Map<string, FakeBudget>();
  readonly categories = new Map<string, FakeCategory>();
  readonly transactions = new Map<string, FakeTransaction>();
  readonly tx = new FakeTransactionClient(this.budgets, this.categories, this.transactions);
  readonly budget = this.tx.budget;
  readonly category = this.tx.category;
  readonly transaction = this.tx.transaction;

  async $transaction<T>(callback: (tx: FakeTransactionClient) => Promise<T>): Promise<T> {
    return callback(this.tx);
  }
}

class FakeAuditService {
  readonly events: Array<{ entityId?: string; eventType: string; userId?: string }> = [];

  async record(input: { entityId?: string; eventType: string; userId?: string }): Promise<void> {
    this.events.push(input);
  }
}

describe("BudgetsService", () => {
  let audit: FakeAuditService;
  let prisma: FakePrismaService;
  let service: BudgetsService;

  beforeEach(() => {
    audit = new FakeAuditService();
    prisma = new FakePrismaService();
    service = new BudgetsService(
      audit as unknown as AuditService,
      prisma as unknown as PrismaService
    );
    seedCategory(prisma, "category-food", "user-1", "expense", "Food");
    seedCategory(prisma, "category-transport", "user-1", "expense", "Transport");
    seedCategory(prisma, "category-income", "user-1", "income", "Salary");
    seedCategory(prisma, "category-other", "user-2", "expense", "Other");
    seedCategory(prisma, "category-archived", "user-1", "expense", "Archived", {
      archivedAt: new Date("2026-05-01T00:00:00.000Z")
    });
    seedCategory(prisma, "category-deleted", "user-1", "expense", "Deleted", {
      deletedAt: new Date("2026-05-01T00:00:00.000Z")
    });
  });

  it("creates and lists a monthly budget with calculated remaining amount", async () => {
    seedTransaction(prisma, {
      amount: "250.00",
      categoryId: "category-food",
      currency: "IDR",
      id: "transaction-1",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense",
      userId: "user-1"
    });

    const budget = await createFoodBudget(service, "1000.00");
    const response = await service.listBudgets("user-1", {
      currency: "IDR",
      periodStart: "2026-05-01"
    });

    expect(budget.periodStart).toBe("2026-05-01");
    expect(budget.periodEnd).toBe("2026-06-01");
    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.spentAmount).toBe("250.0000");
    expect(response.items[0]?.remainingAmount).toBe("750.0000");
    expect(response.items[0]?.spentPercentage).toBe("25.00");
    expect(response.items[0]?.thresholdPercentage).toBe("80.00");
  });

  it("prevents duplicate active budgets for the same category, month, and currency", async () => {
    await createFoodBudget(service, "1000.00");

    await expect(createFoodBudget(service, "1200.00")).rejects.toBeInstanceOf(ConflictException);
  });

  it("reactivates an archived budget with the same category, month, and currency", async () => {
    const budget = await createFoodBudget(service, "1000.00");

    await service.archiveBudget("user-1", budget.id);
    const reactivated = await createFoodBudget(service, "1500.00", 75);

    expect(reactivated.id).toBe(budget.id);
    expect(reactivated.amount).toBe("1500.0000");
    expect(reactivated.thresholdPercentage).toBe("75.00");
    expect(prisma.budgets.get(budget.id)?.status).toBe("active");
  });

  it("rejects zero and negative amounts", async () => {
    await expect(createFoodBudget(service, "0")).rejects.toBeInstanceOf(BadRequestException);
    await expect(createFoodBudget(service, "-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects invalid threshold percentages", async () => {
    await expect(createFoodBudget(service, "1000.00", 0)).rejects.toBeInstanceOf(BadRequestException);
    await expect(createFoodBudget(service, "1000.00", 101)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects periodStart values that are not the first day of a month", async () => {
    await expect(service.createBudget("user-1", {
      amount: "1000.00",
      categoryId: "category-food",
      currency: "IDR",
      periodStart: "2026-05-02"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("includes the start boundary and excludes the next-month boundary", async () => {
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      currency: "IDR",
      id: "transaction-start",
      transactionAt: "2026-05-01T00:00:00.000Z",
      type: "expense",
      userId: "user-1"
    });
    seedTransaction(prisma, {
      amount: "50.00",
      categoryId: "category-food",
      currency: "IDR",
      id: "transaction-end-of-month",
      transactionAt: "2026-05-31T23:59:59.000Z",
      type: "expense",
      userId: "user-1"
    });
    seedTransaction(prisma, {
      amount: "75.00",
      categoryId: "category-food",
      currency: "IDR",
      id: "transaction-next-month",
      transactionAt: "2026-06-01T00:00:00.000Z",
      type: "expense",
      userId: "user-1"
    });

    const budget = await createFoodBudget(service, "200.00");

    expect(budget.spentAmount).toBe("150.0000");
    expect(budget.remainingAmount).toBe("50.0000");
  });

  it("calculates spending only for matching currency", async () => {
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      currency: "IDR",
      id: "transaction-idr",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense",
      userId: "user-1"
    });
    seedTransaction(prisma, {
      amount: "25.00",
      categoryId: "category-food",
      currency: "USD",
      id: "transaction-usd",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense",
      userId: "user-1"
    });

    const budget = await createFoodBudget(service, "200.00");

    expect(budget.spentAmount).toBe("100.0000");
  });

  it("excludes transfer, income, and deleted transactions from spending", async () => {
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      currency: "IDR",
      id: "transaction-expense",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense",
      userId: "user-1"
    });
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      currency: "IDR",
      id: "transaction-income",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "income",
      userId: "user-1"
    });
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      currency: "IDR",
      id: "transaction-deleted",
      isDeleted: true,
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense",
      userId: "user-1"
    });
    seedTransaction(prisma, {
      amount: "100.00",
      categoryId: "category-food",
      currency: "IDR",
      id: "transaction-transfer",
      transactionAt: "2026-05-10T00:00:00.000Z",
      transferGroupId: "transfer-group-1",
      transferSide: "outflow",
      type: "expense",
      userId: "user-1"
    });

    const budget = await createFoodBudget(service, "200.00");

    expect(budget.spentAmount).toBe("100.0000");
  });

  it("calculates threshold warnings and allows negative remaining amount", async () => {
    seedTransaction(prisma, {
      amount: "120.00",
      categoryId: "category-food",
      currency: "IDR",
      id: "transaction-overspent",
      transactionAt: "2026-05-10T00:00:00.000Z",
      type: "expense",
      userId: "user-1"
    });

    const budget = await createFoodBudget(service, "100.00", 80);

    expect(budget.spentPercentage).toBe("120.00");
    expect(budget.remainingAmount).toBe("-20.0000");
    expect(budget.isThresholdExceeded).toBe(true);
  });

  it("rejects income, archived, deleted, and other-user categories", async () => {
    await expect(createBudgetForCategory(service, "category-income")).rejects
      .toBeInstanceOf(BadRequestException);
    await expect(createBudgetForCategory(service, "category-archived")).rejects
      .toBeInstanceOf(NotFoundException);
    await expect(createBudgetForCategory(service, "category-deleted")).rejects
      .toBeInstanceOf(NotFoundException);
    await expect(createBudgetForCategory(service, "category-other")).rejects
      .toBeInstanceOf(NotFoundException);
  });

  it("denies cross-user budget access", async () => {
    const budget = await createFoodBudget(service, "1000.00");

    await expect(service.updateBudget("user-2", budget.id, {
      amount: "1200.00"
    })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.archiveBudget("user-2", budget.id)).rejects
      .toBeInstanceOf(NotFoundException);
  });

  it("rejects updates that collide with another active budget identity", async () => {
    const foodBudget = await createFoodBudget(service, "1000.00");
    await service.createBudget("user-1", {
      amount: "500.00",
      categoryId: "category-transport",
      currency: "IDR",
      periodStart: "2026-05-01"
    });

    await expect(service.updateBudget("user-1", foodBudget.id, {
      categoryId: "category-transport"
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects updates that collide with an archived budget identity", async () => {
    const foodBudget = await createFoodBudget(service, "1000.00");
    const archivedBudget = await service.createBudget("user-1", {
      amount: "500.00",
      categoryId: "category-transport",
      currency: "IDR",
      periodStart: "2026-05-01"
    });
    await service.archiveBudget("user-1", archivedBudget.id);

    await expect(service.updateBudget("user-1", foodBudget.id, {
      categoryId: "category-transport"
    })).rejects.toBeInstanceOf(ConflictException);
  });
});

async function createFoodBudget(
  service: BudgetsService,
  amount: string,
  thresholdPercentage?: number
): Promise<{
  amount: string;
  id: string;
  isThresholdExceeded: boolean;
  periodEnd: string;
  periodStart: string;
  remainingAmount: string;
  spentAmount: string;
  spentPercentage: string;
  thresholdPercentage: string;
}> {
  return service.createBudget("user-1", {
    amount,
    categoryId: "category-food",
    currency: "IDR",
    periodStart: "2026-05-01",
    thresholdPercentage
  });
}

async function createBudgetForCategory(
  service: BudgetsService,
  categoryId: string
): Promise<unknown> {
  return service.createBudget("user-1", {
    amount: "1000.00",
    categoryId,
    currency: "IDR",
    periodStart: "2026-05-01"
  });
}

function seedCategory(
  prisma: FakePrismaService,
  id: string,
  userId: string,
  kind: string,
  name: string,
  options: Partial<Pick<FakeCategory, "archivedAt" | "deletedAt">> = {}
): void {
  prisma.categories.set(id, {
    archivedAt: options.archivedAt ?? null,
    deletedAt: options.deletedAt ?? null,
    id,
    kind,
    name,
    userId
  });
}

function seedTransaction(
  prisma: FakePrismaService,
  input: {
    amount: string;
    categoryId: string | null;
    currency: string;
    id: string;
    isDeleted?: boolean;
    transactionAt: string;
    transferGroupId?: string | null;
    transferSide?: string | null;
    type: string;
    userId: string;
  }
): void {
  prisma.transactions.set(input.id, {
    amount: new Prisma.Decimal(input.amount),
    categoryId: input.categoryId,
    currency: input.currency,
    deletedAt: input.isDeleted === true ? new Date("2026-05-11T00:00:00.000Z") : null,
    id: input.id,
    isDeleted: input.isDeleted ?? false,
    transactionAt: new Date(input.transactionAt),
    transferGroupId: input.transferGroupId ?? null,
    transferSide: input.transferSide ?? null,
    type: input.type,
    userId: input.userId
  });
}

function matchesWhere<TRecord extends Record<string, unknown>>(
  record: TRecord,
  where: Partial<TRecord>
): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) {
      return true;
    }

    const recordValue = record[key];

    if (isFilterObject(value)) {
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

function isFilterObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
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
