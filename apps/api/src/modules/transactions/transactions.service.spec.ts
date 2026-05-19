import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { TransactionsService } from "./transactions.service";

type FakeAccount = {
  archivedAt: Date | null;
  currency: string;
  currentBalance: Prisma.Decimal;
  deletedAt: Date | null;
  id: string;
  name: string;
  userId: string;
};

type FakeCategory = {
  archivedAt: Date | null;
  deletedAt: Date | null;
  id: string;
  kind: string;
  name: string;
  userId: string;
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

type FakeTransactionResponse = FakeTransaction & {
  account: {
    id: string;
    name: string;
  };
  category: {
    id: string;
    kind: string;
    name: string;
  } | null;
};

class FakeTransactionClient {
  private transactionCount = 0;

  readonly account = {
    findFirst: async (input: { where: Partial<FakeAccount> }): Promise<FakeAccount | null> => {
      const account = [...this.accounts.values()].find((candidate) =>
        matchesWhere(candidate, input.where)
      );

      return account ?? null;
    },
    update: async (input: {
      data: { currentBalance: { increment: Prisma.Decimal } };
      where: { id: string };
    }): Promise<FakeAccount> => {
      const account = this.accounts.get(input.where.id);

      if (account === undefined) {
        throw new Error("Fake account not found");
      }

      account.currentBalance = account.currentBalance.plus(input.data.currentBalance.increment);

      return account;
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
    create: async (input: {
      data: {
        accountId: string;
        amount: Prisma.Decimal;
        categoryId?: string;
        currency: string;
        merchant?: string;
        note?: string;
        transactionAt: Date;
        transferGroupId?: string | null;
        transferSide?: string | null;
        type: string;
        userId: string;
      };
    }): Promise<FakeTransactionResponse> => {
      this.transactionCount += 1;
      const transaction: FakeTransaction = {
        accountId: input.data.accountId,
        amount: input.data.amount,
        categoryId: input.data.categoryId ?? null,
        createdAt: new Date("2026-05-17T00:00:00.000Z"),
        currency: input.data.currency,
        deletedAt: null,
        id: `transaction-${this.transactionCount}`,
        isDeleted: false,
        merchant: input.data.merchant ?? null,
        note: input.data.note ?? null,
        status: "posted",
        transactionAt: input.data.transactionAt,
        transferGroupId: input.data.transferGroupId ?? null,
        transferSide: input.data.transferSide ?? null,
        type: input.data.type,
        userId: input.data.userId
      };
      this.transactions.set(transaction.id, transaction);

      return this.withRelations(transaction);
    },
    findFirst: async (input: {
      where: Partial<FakeTransaction>;
    }): Promise<FakeTransactionResponse | null> => {
      const transaction = [...this.transactions.values()].find((candidate) =>
        matchesWhere(candidate, input.where)
      );

      return transaction === undefined ? null : this.withRelations(transaction);
    },
    update: async (input: {
      data: Partial<FakeTransaction>;
      where: { id: string };
    }): Promise<FakeTransactionResponse> => {
      const transaction = this.transactions.get(input.where.id);

      if (transaction === undefined) {
        throw new Error("Fake transaction not found");
      }

      Object.entries(input.data).forEach(([key, value]) => {
        if (value !== undefined) {
          Object.assign(transaction, { [key]: value });
        }
      });

      return this.withRelations(transaction);
    }
  };

  constructor(
    readonly accounts: Map<string, FakeAccount>,
    readonly categories: Map<string, FakeCategory>,
    readonly transactions: Map<string, FakeTransaction>
  ) {}

  withRelationsForRoot(transaction: FakeTransaction): FakeTransactionResponse {
    return this.withRelations(transaction);
  }

  private withRelations(transaction: FakeTransaction): FakeTransactionResponse {
    const account = this.accounts.get(transaction.accountId);
    const category = transaction.categoryId === null
      ? null
      : this.categories.get(transaction.categoryId) ?? null;

    if (account === undefined) {
      throw new Error("Fake relation account not found");
    }

    return {
      ...transaction,
      account: {
        id: account.id,
        name: account.name
      },
      category: category === null
        ? null
        : {
            id: category.id,
            kind: category.kind,
            name: category.name
          }
    };
  }
}

class FakePrismaService {
  readonly accounts = new Map<string, FakeAccount>();
  readonly categories = new Map<string, FakeCategory>();
  readonly transactions = new Map<string, FakeTransaction>();
  readonly tx = new FakeTransactionClient(this.accounts, this.categories, this.transactions);
  readonly transaction = {
    findMany: async (input: {
      skip?: number;
      take?: number;
      where: Partial<FakeTransaction>;
    }): Promise<FakeTransactionResponse[]> => {
      const skip = input.skip ?? 0;
      const take = input.take ?? this.transactions.size;

      return [...this.transactions.values()]
        .filter((candidate) => matchesWhere(candidate, input.where))
        .sort((left, right) => {
          const dateDifference = right.transactionAt.getTime() - left.transactionAt.getTime();

          return dateDifference !== 0
            ? dateDifference
            : right.createdAt.getTime() - left.createdAt.getTime();
        })
        .slice(skip, skip + take)
        .map((transaction) => this.tx.withRelationsForRoot(transaction));
    }
  };

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

describe("TransactionsService", () => {
  let audit: FakeAuditService;
  let prisma: FakePrismaService;
  let service: TransactionsService;

  beforeEach(() => {
    audit = new FakeAuditService();
    prisma = new FakePrismaService();
    service = new TransactionsService(
      audit as unknown as AuditService,
      prisma as unknown as PrismaService
    );
    seedAccount(prisma, "account-1", "user-1", "1000.0000");
    seedAccount(prisma, "account-2", "user-1", "500.0000");
    seedAccount(prisma, "account-other", "user-2", "1000.0000");
    seedCategory(prisma, "category-expense", "user-1", "expense");
    seedCategory(prisma, "category-income", "user-1", "income");
  });

  it("adds balance when creating income", async () => {
    const transaction = await service.createTransaction("user-1", {
      accountId: "account-1",
      amount: "200.00",
      currency: "IDR",
      transactionAt: "2026-05-17T10:00:00.000Z",
      type: "income"
    });

    expect(transaction.amount).toBe("200.0000");
    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("1200.0000");
  });

  it("subtracts balance when creating expense", async () => {
    await service.createTransaction("user-1", {
      accountId: "account-1",
      amount: "200.00",
      currency: "IDR",
      transactionAt: "2026-05-17T10:00:00.000Z",
      type: "expense"
    });

    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("800.0000");
  });

  it("reverses old amount and applies new amount on update", async () => {
    const transaction = await createExpense(service);

    await service.updateTransaction("user-1", transaction.id, {
      amount: "150.00"
    });

    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("850.0000");
  });

  it("reverses old type and applies new type on update", async () => {
    const transaction = await createExpense(service);

    await service.updateTransaction("user-1", transaction.id, {
      type: "income"
    });

    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("1100.0000");
  });

  it("reverses old account and applies new account on update", async () => {
    const transaction = await createExpense(service);

    await service.updateTransaction("user-1", transaction.id, {
      accountId: "account-2"
    });

    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("1000.0000");
    expect(prisma.accounts.get("account-2")?.currentBalance.toFixed(4)).toBe("400.0000");
  });

  it("soft deletes and reverses balance on delete", async () => {
    const transaction = await service.createTransaction("user-1", {
      accountId: "account-1",
      amount: "200.00",
      currency: "IDR",
      transactionAt: "2026-05-17T10:00:00.000Z",
      type: "income"
    });

    await service.deleteTransaction("user-1", transaction.id);

    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("1000.0000");
    expect(prisma.transactions.get(transaction.id)?.isDeleted).toBe(true);
    expect(prisma.transactions.get(transaction.id)?.deletedAt).toBeInstanceOf(Date);
  });

  it("denies cross-user access", async () => {
    const transaction = await createExpense(service);

    await expect(service.updateTransaction("user-2", transaction.id, {
      amount: "50.00"
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects invalid zero amount", async () => {
    await expect(service.createTransaction("user-1", {
      accountId: "account-1",
      amount: "0",
      currency: "IDR",
      transactionAt: "2026-05-17T10:00:00.000Z",
      type: "income"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects category kind mismatches", async () => {
    await expect(service.createTransaction("user-1", {
      accountId: "account-1",
      amount: "100.00",
      categoryId: "category-income",
      currency: "IDR",
      transactionAt: "2026-05-17T10:00:00.000Z",
      type: "expense"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("excludes transfer legs from the normal transaction list", async () => {
    await createExpense(service);
    seedTransferLeg(prisma, "transfer-outflow", "user-1", "account-1", "outflow");
    seedTransferLeg(prisma, "transfer-inflow", "user-1", "account-2", "inflow");

    const response = await service.listTransactions("user-1", {});

    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.type).toBe("expense");
  });

  it("does not allow normal transaction update for transfer legs", async () => {
    seedTransferLeg(prisma, "transfer-outflow", "user-1", "account-1", "outflow");

    await expect(service.updateTransaction("user-1", "transfer-outflow", {
      amount: "50.00"
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("does not allow normal transaction delete for transfer legs", async () => {
    seedTransferLeg(prisma, "transfer-outflow", "user-1", "account-1", "outflow");

    await expect(service.deleteTransaction("user-1", "transfer-outflow"))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

function seedAccount(
  prisma: FakePrismaService,
  id: string,
  userId: string,
  currentBalance: string
): void {
  prisma.accounts.set(id, {
    archivedAt: null,
    currency: "IDR",
    currentBalance: new Prisma.Decimal(currentBalance),
    deletedAt: null,
    id,
    name: id,
    userId
  });
}

function seedCategory(
  prisma: FakePrismaService,
  id: string,
  userId: string,
  kind: string
): void {
  prisma.categories.set(id, {
    archivedAt: null,
    deletedAt: null,
    id,
    kind,
    name: id,
    userId
  });
}

function seedTransferLeg(
  prisma: FakePrismaService,
  id: string,
  userId: string,
  accountId: string,
  transferSide: "inflow" | "outflow"
): void {
  prisma.transactions.set(id, {
    accountId,
    amount: new Prisma.Decimal("100.0000"),
    categoryId: null,
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
    currency: "IDR",
    deletedAt: null,
    id,
    isDeleted: false,
    merchant: null,
    note: null,
    status: "posted",
    transactionAt: new Date("2026-05-17T10:00:00.000Z"),
    transferGroupId: "transfer-group-1",
    transferSide,
    type: "transfer",
    userId
  });
}

async function createExpense(service: TransactionsService): Promise<{ id: string }> {
  return service.createTransaction("user-1", {
    accountId: "account-1",
    amount: "100.00",
    currency: "IDR",
    transactionAt: "2026-05-17T10:00:00.000Z",
    type: "expense"
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

    if (key === "OR" && Array.isArray(value)) {
      return value.some((candidate) => matchesWhere(record, candidate as Partial<TRecord>));
    }

    const recordValue = record[key];

    if (isFilterObject(value)) {
      if ("in" in value && Array.isArray(value.in) && !value.in.includes(recordValue)) {
        return false;
      }

      if ("not" in value && recordValue === value.not) {
        return false;
      }

      if ("gte" in value && value.gte !== undefined && compareValues(recordValue, value.gte) < 0) {
        return false;
      }

      if ("lte" in value && value.lte !== undefined && compareValues(recordValue, value.lte) > 0) {
        return false;
      }

      return true;
    }

    return recordValue === value;
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

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right));
}
