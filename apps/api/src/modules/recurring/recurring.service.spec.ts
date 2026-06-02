import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma, RecurringRule } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  RecurringRulesService,
  ScheduleRule
} from "./recurring.service";

type FakeAccount = {
  archivedAt: Date | null;
  currency: string;
  currentBalance: Prisma.Decimal;
  deletedAt: Date | null;
  id: string;
  userId: string;
};

type FakeCategory = {
  archivedAt: Date | null;
  deletedAt: Date | null;
  id: string;
  kind: string;
  userId: string;
};

type FakeGeneratedTransaction = {
  accountId: string;
  amount: Prisma.Decimal;
  categoryId: string | null;
  currency: string;
  deletedAt: Date | null;
  id: string;
  isDeleted: boolean;
  merchant: string | null;
  recurringOccurrenceAt: Date;
  recurringRuleId: string;
  source: string;
  transactionAt: Date;
  type: string;
  userId: string;
};

type FakeAuditEvent = {
  entityId?: string;
  eventType: string;
  metadata?: Prisma.InputJsonValue;
  userId?: string;
};

type RuleWhere = {
  archivedAt?: Date | null;
  id?: string;
  nextRunAt?: {
    lte: Date;
  };
  pausedAt?: Date | null;
  userId?: string;
};

const createdAt = new Date("2026-01-01T00:00:00.000Z");

class FakePrismaService {
  private recurringRuleCount = 0;
  private transactionCount = 0;

  readonly accounts = new Map<string, FakeAccount>();
  readonly auditEvents: FakeAuditEvent[] = [];
  readonly categories = new Map<string, FakeCategory>();
  readonly recurringRules = new Map<string, RecurringRule>();
  readonly transactions = new Map<string, FakeGeneratedTransaction>();
  readonly users = new Map<string, { deletedAt: Date | null; id: string; status: string; timezone: string }>();

  readonly account = {
    findFirst: async (input: {
      where: Partial<FakeAccount>;
    }): Promise<Pick<FakeAccount, "currency" | "id"> | null> => {
      const account = [...this.accounts.values()].find((candidate) =>
        matchesSimple(candidate, input.where)
      );

      return account === undefined
        ? null
        : {
            currency: account.currency,
            id: account.id
          };
    },
    update: async (input: {
      data: {
        currentBalance: {
          increment: Prisma.Decimal;
        };
      };
      where: {
        id: string;
      };
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
      data: FakeAuditEvent;
    }): Promise<FakeAuditEvent> => {
      this.auditEvents.push(input.data);

      return input.data;
    }
  };

  readonly category = {
    findFirst: async (input: {
      where: Partial<FakeCategory>;
    }): Promise<Pick<FakeCategory, "id"> | null> => {
      const category = [...this.categories.values()].find((candidate) =>
        matchesSimple(candidate, input.where)
      );

      return category === undefined ? null : { id: category.id };
    }
  };

  readonly recurringRule = {
    create: async (input: {
      data: {
        dayOfMonth: number | null;
        endAt: Date | null;
        frequency: string;
        intervalCount: number;
        name: string;
        nextRunAt: Date | null;
        startAt: Date;
        templatePayload: Prisma.JsonValue;
        timezone: string;
        userId: string;
      };
    }): Promise<RecurringRule> => {
      this.recurringRuleCount += 1;
      const rule: RecurringRule = {
        ...input.data,
        archivedAt: null,
        createdAt,
        id: `rule-${this.recurringRuleCount}`,
        lastFailedAt: null,
        lastGenerationErrorCode: null,
        lastRunAt: null,
        pausedAt: null,
        updatedAt: createdAt
      };

      this.recurringRules.set(rule.id, rule);

      return rule;
    },
    findFirst: async (input: {
      where: RuleWhere;
    }): Promise<RecurringRule | null> => {
      const rule = this.findRule(input.where);

      return rule ?? null;
    },
    findMany: async (input: {
      skip?: number;
      take?: number;
      where: RuleWhere;
    }): Promise<RecurringRule[]> => {
      const skip = input.skip ?? 0;
      const take = input.take ?? this.recurringRules.size;

      return [...this.recurringRules.values()]
        .filter((rule) => matchesRule(rule, input.where))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(skip, skip + take);
    },
    update: async (input: {
      data: Partial<RecurringRule>;
      where: {
        id: string;
      };
    }): Promise<RecurringRule> => {
      const rule = this.recurringRules.get(input.where.id);

      if (rule === undefined) {
        throw new Error("Fake recurring rule not found");
      }

      Object.entries(input.data).forEach(([key, value]) => {
        if (value !== undefined) {
          Object.assign(rule, { [key]: value });
        }
      });

      return rule;
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
        recurringOccurrenceAt: Date;
        recurringRuleId: string;
        source: string;
        transactionAt: Date;
        type: string;
        userId: string;
      };
    }): Promise<FakeGeneratedTransaction> => {
      this.transactionCount += 1;
      const transaction: FakeGeneratedTransaction = {
        ...input.data,
        categoryId: input.data.categoryId ?? null,
        deletedAt: null,
        id: `transaction-${this.transactionCount}`,
        isDeleted: false,
        merchant: input.data.merchant ?? null
      };

      this.transactions.set(transaction.id, transaction);

      return transaction;
    },
    findFirst: async (input: {
      where: Partial<FakeGeneratedTransaction>;
    }): Promise<Pick<FakeGeneratedTransaction, "id"> | null> => {
      const transaction = [...this.transactions.values()].find((candidate) =>
        matchesSimple(candidate, input.where)
      );

      return transaction === undefined ? null : { id: transaction.id };
    }
  };

  readonly user = {
    findFirst: async (input: {
      where: {
        deletedAt: Date | null;
        id: string;
        status: string;
      };
    }): Promise<{ timezone: string } | null> => {
      const user = this.users.get(input.where.id);

      return user !== undefined && matchesSimple(user, input.where)
        ? { timezone: user.timezone }
        : null;
    }
  };

  async $transaction<T>(callback: (tx: FakePrismaService) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private findRule(where: RuleWhere): RecurringRule | undefined {
    return [...this.recurringRules.values()]
      .filter((rule) => matchesRule(rule, where))
      .sort((left, right) => {
        const leftRunAt = left.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightRunAt = right.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const runDifference = leftRunAt - rightRunAt;

        return runDifference !== 0 ? runDifference : left.id.localeCompare(right.id);
      })[0];
  }
}

class FakeAuditService {
  readonly events: FakeAuditEvent[] = [];

  async record(input: FakeAuditEvent): Promise<void> {
    this.events.push(input);
  }
}

describe("RecurringRulesService", () => {
  let audit: FakeAuditService;
  let prisma: FakePrismaService;
  let service: RecurringRulesService;

  beforeEach(() => {
    audit = new FakeAuditService();
    prisma = new FakePrismaService();
    service = new RecurringRulesService(
      audit as unknown as AuditService,
      prisma as unknown as PrismaService
    );
    prisma.users.set("user-1", {
      deletedAt: null,
      id: "user-1",
      status: "active",
      timezone: "Asia/Jakarta"
    });
    seedAccount(prisma);
    seedCategory(prisma);
  });

  it("snapshots the user timezone and starts a historical anchor at the next upcoming run", async () => {
    const rule = await createRule(service, {
      now: "2026-05-03T03:00:00.000Z",
      startAt: "2026-05-01T09:00:00+07:00"
    });

    expect(rule.timezone).toBe("Asia/Jakarta");
    expect(rule.nextRunAt).toBe("2026-05-04T02:00:00.000Z");
  });

  it("rejects interval counts below one", async () => {
    await expect(service.createRule("user-1", {
      frequency: "daily",
      intervalCount: 0,
      name: "Invalid",
      startAt: "2026-05-01T09:00:00+07:00",
      template: {
        accountId: "account-1",
        amount: "125.00",
        currency: "IDR",
        type: "expense"
      }
    }, new Date("2026-05-01T00:00:00.000Z"))).rejects
      .toBeInstanceOf(BadRequestException);
  });

  it("keeps daily and weekly wall-clock time through DST", () => {
    const daily = schedule({
      frequency: "daily",
      startAt: "2026-03-07T14:00:00.000Z",
      timezone: "America/New_York"
    });
    const weekly = schedule({
      frequency: "weekly",
      startAt: "2026-03-01T14:00:00.000Z",
      timezone: "America/New_York"
    });

    expect(service.getFollowingOccurrence(daily, daily.startAt)?.toISOString())
      .toBe("2026-03-08T13:00:00.000Z");
    expect(service.getFollowingOccurrence(weekly, weekly.startAt)?.toISOString())
      .toBe("2026-03-08T13:00:00.000Z");
  });

  it("clamps short months without permanently drifting the monthly day", () => {
    const rule = schedule({
      dayOfMonth: 31,
      frequency: "monthly",
      startAt: "2026-01-31T02:00:00.000Z"
    });
    const february = service.getFollowingOccurrence(rule, rule.startAt);
    const march = february === null ? null : service.getFollowingOccurrence(rule, february);

    expect(february?.toISOString()).toBe("2026-02-28T02:00:00.000Z");
    expect(march?.toISOString()).toBe("2026-03-31T02:00:00.000Z");
  });

  it("treats endAt as inclusive", () => {
    const rule = schedule({
      endAt: "2026-02-28T02:00:00.000Z",
      frequency: "monthly",
      startAt: "2026-01-31T02:00:00.000Z"
    });
    const february = service.getFollowingOccurrence(rule, rule.startAt);
    const march = february === null ? null : service.getFollowingOccurrence(rule, february);

    expect(february?.toISOString()).toBe("2026-02-28T02:00:00.000Z");
    expect(march).toBeNull();
  });

  it("generates a due expense as a normal recurring ledger row and updates the balance", async () => {
    const rule = await createRule(service, {
      now: "2026-05-01T00:00:00.000Z",
      startAt: "2026-05-01T09:00:00+07:00"
    });

    const result = await service.generateDueOccurrence(
      "user-1",
      rule.id,
      new Date("2026-05-01T03:00:00.000Z")
    );
    const transaction = [...prisma.transactions.values()][0];

    expect(result).toBe("generated");
    expect(transaction?.source).toBe("recurring");
    expect(transaction?.transactionAt.toISOString()).toBe("2026-05-01T02:00:00.000Z");
    expect(transaction?.recurringOccurrenceAt.toISOString()).toBe("2026-05-01T02:00:00.000Z");
    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("875.0000");
  });

  it("advances an existing occurrence without regenerating it after soft delete", async () => {
    const rule = await createRule(service, {
      now: "2026-05-01T00:00:00.000Z",
      startAt: "2026-05-01T09:00:00+07:00"
    });
    await service.generateDueOccurrence(
      "user-1",
      rule.id,
      new Date("2026-05-01T03:00:00.000Z")
    );
    const transaction = [...prisma.transactions.values()][0];
    const storedRule = prisma.recurringRules.get(rule.id);

    if (transaction === undefined || storedRule === undefined) {
      throw new Error("Expected seeded recurring generation");
    }

    transaction.deletedAt = new Date("2026-05-01T04:00:00.000Z");
    transaction.isDeleted = true;
    storedRule.nextRunAt = transaction.recurringOccurrenceAt;

    const result = await service.generateDueOccurrence(
      "user-1",
      rule.id,
      new Date("2026-05-01T05:00:00.000Z")
    );

    expect(result).toBe("duplicate");
    expect(prisma.transactions).toHaveLength(1);
    expect(storedRule.nextRunAt?.toISOString()).toBe("2026-05-02T02:00:00.000Z");
  });

  it("catches up missed occurrences with a bounded limit", async () => {
    await createRule(service, {
      now: "2026-05-01T00:00:00.000Z",
      startAt: "2026-05-01T09:00:00+07:00"
    });

    const summary = await service.generateDueTransactions(
      new Date("2026-05-05T03:00:00.000Z"),
      3
    );

    expect(summary.generatedCount).toBe(3);
    expect(summary.processedCount).toBe(3);
    expect(prisma.transactions).toHaveLength(3);
  });

  it("auto-pauses without creating a row or changing balance when an account becomes unavailable", async () => {
    const rule = await createRule(service, {
      now: "2026-05-01T00:00:00.000Z",
      startAt: "2026-05-01T09:00:00+07:00"
    });
    const account = prisma.accounts.get("account-1");

    if (account === undefined) {
      throw new Error("Expected seeded account");
    }

    account.archivedAt = new Date("2026-05-01T01:00:00.000Z");

    const result = await service.generateDueOccurrence(
      "user-1",
      rule.id,
      new Date("2026-05-01T03:00:00.000Z")
    );
    const storedRule = prisma.recurringRules.get(rule.id);

    expect(result).toBe("auto_paused");
    expect(prisma.transactions).toHaveLength(0);
    expect(account.currentBalance.toFixed(4)).toBe("1000.0000");
    expect(storedRule?.lastGenerationErrorCode).toBe("ACCOUNT_UNAVAILABLE");
    expect(storedRule?.pausedAt).toBeInstanceOf(Date);
  });

  it("auto-pauses without generating when a category becomes unavailable", async () => {
    const rule = await createRule(service, {
      now: "2026-05-01T00:00:00.000Z",
      startAt: "2026-05-01T09:00:00+07:00"
    });
    const category = prisma.categories.get("category-expense");

    if (category === undefined) {
      throw new Error("Expected seeded category");
    }

    category.archivedAt = new Date("2026-05-01T01:00:00.000Z");

    const result = await service.generateDueOccurrence(
      "user-1",
      rule.id,
      new Date("2026-05-01T03:00:00.000Z")
    );

    expect(result).toBe("auto_paused");
    expect(prisma.transactions).toHaveLength(0);
    expect(prisma.recurringRules.get(rule.id)?.lastGenerationErrorCode)
      .toBe("CATEGORY_UNAVAILABLE");
  });

  it("resumes at the next upcoming occurrence and skips the paused period", async () => {
    const rule = await createRule(service, {
      now: "2026-05-01T00:00:00.000Z",
      startAt: "2026-05-01T09:00:00+07:00"
    });
    await service.pauseRule("user-1", rule.id, new Date("2026-05-01T01:00:00.000Z"));

    const resumed = await service.resumeRule(
      "user-1",
      rule.id,
      new Date("2026-05-04T03:00:00.000Z")
    );

    expect(resumed.status).toBe("active");
    expect(resumed.nextRunAt).toBe("2026-05-05T02:00:00.000Z");
  });

  it("denies cross-user lifecycle access", async () => {
    const rule = await createRule(service, {
      now: "2026-05-01T00:00:00.000Z",
      startAt: "2026-05-01T09:00:00+07:00"
    });

    await expect(service.archiveRule("user-2", rule.id)).rejects
      .toBeInstanceOf(NotFoundException);
  });
});

async function createRule(
  service: RecurringRulesService,
  input: {
    now: string;
    startAt: string;
  }
): Promise<{ id: string; nextRunAt: string | null; status: string; timezone: string }> {
  return service.createRule("user-1", {
    frequency: "daily",
    intervalCount: 1,
    name: "Internet",
    startAt: input.startAt,
    template: {
      accountId: "account-1",
      amount: "125.00",
      categoryId: "category-expense",
      currency: "IDR",
      merchant: "Internet Provider",
      type: "expense"
    }
  }, new Date(input.now));
}

function schedule(input: {
  dayOfMonth?: number;
  endAt?: string;
  frequency: "daily" | "monthly" | "weekly";
  startAt: string;
  timezone?: string;
}): ScheduleRule {
  return {
    dayOfMonth: input.frequency === "monthly" ? input.dayOfMonth ?? 31 : null,
    endAt: input.endAt === undefined ? null : new Date(input.endAt),
    frequency: input.frequency,
    intervalCount: 1,
    startAt: new Date(input.startAt),
    timezone: input.timezone ?? "UTC"
  };
}

function seedAccount(prisma: FakePrismaService): void {
  prisma.accounts.set("account-1", {
    archivedAt: null,
    currency: "IDR",
    currentBalance: new Prisma.Decimal("1000.0000"),
    deletedAt: null,
    id: "account-1",
    userId: "user-1"
  });
}

function seedCategory(prisma: FakePrismaService): void {
  prisma.categories.set("category-expense", {
    archivedAt: null,
    deletedAt: null,
    id: "category-expense",
    kind: "expense",
    userId: "user-1"
  });
}

function matchesRule(rule: RecurringRule, where: RuleWhere): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) {
      return true;
    }

    if (key === "nextRunAt" && typeof value === "object" && value !== null && "lte" in value) {
      return rule.nextRunAt !== null && rule.nextRunAt.getTime() <= value.lte.getTime();
    }

    return rule[key as keyof RecurringRule] === value;
  });
}

function matchesSimple<TRecord extends object>(
  record: TRecord,
  where: Partial<TRecord>
): boolean {
  return Object.entries(where).every(([key, value]) =>
    value === undefined || record[key as keyof TRecord] === value
  );
}
