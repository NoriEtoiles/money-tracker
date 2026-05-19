import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { TransfersService } from "./transfers.service";

type FakeAccount = {
  archivedAt: Date | null;
  currency: string;
  currentBalance: Prisma.Decimal;
  deletedAt: Date | null;
  id: string;
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

type FakeTransferResponse = FakeTransaction & {
  account: {
    currency: string;
    id: string;
    name: string;
  };
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

  readonly auditEvent = {
    create: async (input: {
      data: {
        entityId?: string;
        entityType?: string;
        eventType: string;
        metadata?: Prisma.InputJsonValue;
        userId?: string;
      };
    }): Promise<void> => {
      this.auditEvents.push(input.data);
    }
  };

  readonly transaction = {
    create: async (input: {
      data: {
        accountId: string;
        amount: Prisma.Decimal;
        categoryId: string | null;
        currency: string;
        note?: string;
        transactionAt: Date;
        transferGroupId: string;
        transferSide: string;
        type: string;
        userId: string;
      };
    }): Promise<FakeTransferResponse> => {
      this.transactionCount += 1;
      const transaction: FakeTransaction = {
        accountId: input.data.accountId,
        amount: input.data.amount,
        categoryId: input.data.categoryId,
        createdAt: new Date(`2026-05-17T00:00:0${this.transactionCount}.000Z`),
        currency: input.data.currency,
        deletedAt: null,
        id: `transaction-${this.transactionCount}`,
        isDeleted: false,
        merchant: null,
        note: input.data.note ?? null,
        status: "posted",
        transactionAt: input.data.transactionAt,
        transferGroupId: input.data.transferGroupId,
        transferSide: input.data.transferSide,
        type: input.data.type,
        userId: input.data.userId
      };
      this.transactions.set(transaction.id, transaction);

      return this.withRelations(transaction);
    },
    findMany: async (input: {
      cursor?: { id: string };
      skip?: number;
      take?: number;
      where: Partial<FakeTransaction>;
    }): Promise<FakeTransferResponse[]> => {
      let results = [...this.transactions.values()]
        .filter((candidate) => matchesWhere(candidate, input.where))
        .sort((left, right) => {
          const dateDifference = right.transactionAt.getTime() - left.transactionAt.getTime();

          return dateDifference !== 0
            ? dateDifference
            : right.createdAt.getTime() - left.createdAt.getTime();
        });

      if (input.cursor !== undefined) {
        const cursorIndex = results.findIndex((transaction) => transaction.id === input.cursor?.id);

        results = cursorIndex === -1 ? [] : results.slice(cursorIndex);
      }

      const skip = input.skip ?? 0;
      const take = input.take ?? results.length;

      return results.slice(skip, skip + take).map((transaction) => this.withRelations(transaction));
    },
    update: async (input: {
      data: Partial<FakeTransaction>;
      where: { id: string };
    }): Promise<FakeTransferResponse> => {
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
    readonly transactions: Map<string, FakeTransaction>,
    readonly auditEvents: Array<{
      entityId?: string;
      entityType?: string;
      eventType: string;
      metadata?: Prisma.InputJsonValue;
      userId?: string;
    }>
  ) {}

  private withRelations(transaction: FakeTransaction): FakeTransferResponse {
    const account = this.accounts.get(transaction.accountId);

    if (account === undefined) {
      throw new Error("Fake relation account not found");
    }

    return {
      ...transaction,
      account: {
        currency: account.currency,
        id: account.id,
        name: account.name
      }
    };
  }
}

class FakePrismaService {
  readonly accounts = new Map<string, FakeAccount>();
  readonly transactions = new Map<string, FakeTransaction>();
  readonly auditEvents: Array<{
    entityId?: string;
    entityType?: string;
    eventType: string;
    metadata?: Prisma.InputJsonValue;
    userId?: string;
  }> = [];
  readonly tx = new FakeTransactionClient(this.accounts, this.transactions, this.auditEvents);
  readonly transaction = this.tx.transaction;

  async $transaction<T>(callback: (tx: FakeTransactionClient) => Promise<T>): Promise<T> {
    return callback(this.tx);
  }
}

describe("TransfersService", () => {
  let prisma: FakePrismaService;
  let service: TransfersService;

  beforeEach(() => {
    prisma = new FakePrismaService();
    service = new TransfersService(prisma as unknown as PrismaService);
    seedAccount(prisma, "account-1", "user-1", "1000.0000", "IDR");
    seedAccount(prisma, "account-2", "user-1", "500.0000", "IDR");
    seedAccount(prisma, "account-3", "user-1", "200.0000", "IDR");
    seedAccount(prisma, "account-usd", "user-1", "100.0000", "USD");
    seedAccount(prisma, "account-other", "user-2", "1000.0000", "IDR");
  });

  it("creates two linked transfer legs and moves balances", async () => {
    const transfer = await createTransfer(service);
    const outflow = prisma.transactions.get(transfer.outflowTransactionId);
    const inflow = prisma.transactions.get(transfer.inflowTransactionId);

    expect(transfer.amount).toBe("100.0000");
    expect(transfer.currency).toBe("IDR");
    expect(outflow?.type).toBe("transfer");
    expect(outflow?.transferSide).toBe("outflow");
    expect(outflow?.transferGroupId).toBe(transfer.transferGroupId);
    expect(outflow?.categoryId).toBeNull();
    expect(inflow?.type).toBe("transfer");
    expect(inflow?.transferSide).toBe("inflow");
    expect(inflow?.transferGroupId).toBe(transfer.transferGroupId);
    expect(inflow?.categoryId).toBeNull();
    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("900.0000");
    expect(prisma.accounts.get("account-2")?.currentBalance.toFixed(4)).toBe("600.0000");
    expect(prisma.auditEvents[0]?.eventType).toBe("transfer_create");
  });

  it("lists one grouped record per transfer group", async () => {
    const transfer = await createTransfer(service);

    const response = await service.listTransfers("user-1", {});

    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.transferGroupId).toBe(transfer.transferGroupId);
    expect(response.items[0]?.fromAccount.id).toBe("account-1");
    expect(response.items[0]?.toAccount.id).toBe("account-2");
  });

  it("rejects zero transfer amounts", async () => {
    await expect(service.createTransfer("user-1", {
      amount: "0",
      fromAccountId: "account-1",
      toAccountId: "account-2",
      transactionAt: "2026-05-17T10:00:00.000Z"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects same-account transfers", async () => {
    await expect(service.createTransfer("user-1", {
      amount: "100.00",
      fromAccountId: "account-1",
      toAccountId: "account-1",
      transactionAt: "2026-05-17T10:00:00.000Z"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects cross-user destination accounts", async () => {
    await expect(service.createTransfer("user-1", {
      amount: "100.00",
      fromAccountId: "account-1",
      toAccountId: "account-other",
      transactionAt: "2026-05-17T10:00:00.000Z"
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects currency mismatches", async () => {
    await expect(service.createTransfer("user-1", {
      amount: "100.00",
      fromAccountId: "account-1",
      toAccountId: "account-usd",
      transactionAt: "2026-05-17T10:00:00.000Z"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updates amount and accounts while preserving balances", async () => {
    const transfer = await createTransfer(service);

    await service.updateTransfer("user-1", transfer.transferGroupId, {
      amount: "150.00",
      fromAccountId: "account-2",
      toAccountId: "account-3"
    });

    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("1000.0000");
    expect(prisma.accounts.get("account-2")?.currentBalance.toFixed(4)).toBe("350.0000");
    expect(prisma.accounts.get("account-3")?.currentBalance.toFixed(4)).toBe("350.0000");
    expect(prisma.auditEvents.at(-1)?.eventType).toBe("transfer_update");
  });

  it("updates date and note without changing balances", async () => {
    const transfer = await createTransfer(service);

    const updated = await service.updateTransfer("user-1", transfer.transferGroupId, {
      note: "Moved for savings",
      transactionAt: "2026-05-18T10:00:00.000Z"
    });

    expect(updated.note).toBe("Moved for savings");
    expect(updated.transactionAt).toBe("2026-05-18T10:00:00.000Z");
    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("900.0000");
    expect(prisma.accounts.get("account-2")?.currentBalance.toFixed(4)).toBe("600.0000");
  });

  it("soft deletes both legs and reverses balances", async () => {
    const transfer = await createTransfer(service);

    await service.deleteTransfer("user-1", transfer.transferGroupId);

    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("1000.0000");
    expect(prisma.accounts.get("account-2")?.currentBalance.toFixed(4)).toBe("500.0000");
    expect(prisma.transactions.get(transfer.outflowTransactionId)?.isDeleted).toBe(true);
    expect(prisma.transactions.get(transfer.inflowTransactionId)?.isDeleted).toBe(true);
    expect(prisma.transactions.get(transfer.outflowTransactionId)?.deletedAt).toBeInstanceOf(Date);
    expect(prisma.transactions.get(transfer.inflowTransactionId)?.deletedAt).toBeInstanceOf(Date);
    expect(prisma.auditEvents.at(-1)?.eventType).toBe("transfer_delete");
  });

  it("rejects inconsistent transfer pairs without changing balances", async () => {
    const transfer = await createTransfer(service);
    prisma.transactions.delete(transfer.inflowTransactionId);

    await expect(service.updateTransfer("user-1", transfer.transferGroupId, {
      amount: "150.00"
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("900.0000");
    expect(prisma.accounts.get("account-2")?.currentBalance.toFixed(4)).toBe("600.0000");
  });
});

async function createTransfer(service: TransfersService) {
  return service.createTransfer("user-1", {
    amount: "100.00",
    fromAccountId: "account-1",
    note: "Top up",
    toAccountId: "account-2",
    transactionAt: "2026-05-17T10:00:00.000Z"
  });
}

function seedAccount(
  prisma: FakePrismaService,
  id: string,
  userId: string,
  currentBalance: string,
  currency: string
): void {
  prisma.accounts.set(id, {
    archivedAt: null,
    currency,
    currentBalance: new Prisma.Decimal(currentBalance),
    deletedAt: null,
    id,
    name: id,
    userId
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
      if ("in" in value && Array.isArray(value.in) && !value.in.includes(recordValue)) {
        return false;
      }

      if ("not" in value && recordValue === value.not) {
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
