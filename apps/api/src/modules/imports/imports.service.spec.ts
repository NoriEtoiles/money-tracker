import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { PreviewCsvImportDto } from "./dto/preview-csv-import.dto";
import { CsvImportUploadFile, ImportsService, maxCsvFileBytes } from "./imports.service";

type FakeCsvImport = {
  completedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
  filename: string;
  id: string;
  mapping: Prisma.JsonValue | null;
  stagedRows: Prisma.JsonValue | null;
  status: string;
  summary: Prisma.JsonValue | null;
  userId: string;
};

type FakeAccount = {
  archivedAt: Date | null;
  currency: string;
  currentBalance: Prisma.Decimal;
  deletedAt: Date | null;
  id: string;
  userId: string;
};

type FakeImportedTransaction = {
  accountId: string;
  amount: Prisma.Decimal;
  categoryId?: string | null;
  currency: string;
  importId?: string | null;
  importRowNumber?: number | null;
  merchant?: string | null;
  note?: string | null;
  recurringOccurrenceAt?: Date | null;
  recurringRuleId?: string | null;
  source: string;
  transactionAt: Date;
  transferGroupId?: string | null;
  transferSide?: string | null;
  type: string;
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
  private importCount = 0;

  readonly accounts = new Map<string, FakeAccount>();
  readonly auditEvents: FakeAuditEvent[] = [];
  readonly csvImports = new Map<string, FakeCsvImport>();
  readonly importedTransactions: FakeImportedTransaction[] = [];
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

  readonly csvImport = {
    create: async (input: {
      data: {
        expiresAt: Date;
        filename: string;
        stagedRows: Prisma.InputJsonValue;
        status: string;
        summary: Prisma.InputJsonValue;
        userId: string;
      };
    }): Promise<FakeCsvImport> => {
      this.importCount += 1;
      const csvImport: FakeCsvImport = {
        ...input.data,
        completedAt: null,
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        id: `import-${this.importCount}`,
        mapping: null,
        stagedRows: input.data.stagedRows as unknown as Prisma.JsonValue,
        summary: input.data.summary as unknown as Prisma.JsonValue
      };

      this.csvImports.set(csvImport.id, csvImport);

      return csvImport;
    },
    findFirst: async (input: {
      where: Partial<FakeCsvImport>;
    }): Promise<FakeCsvImport | null> => {
      const csvImport = [...this.csvImports.values()].find((candidate) =>
        matchesSimple(candidate, input.where)
      );

      return csvImport ?? null;
    },
    findMany: async (input: {
      skip?: number;
      take?: number;
      where: Partial<FakeCsvImport>;
    }): Promise<FakeCsvImport[]> => {
      const skip = input.skip ?? 0;
      const take = input.take ?? this.csvImports.size;

      return [...this.csvImports.values()]
        .filter((candidate) => matchesSimple(candidate, input.where))
        .slice(skip, skip + take);
    },
    update: async (input: {
      data: Partial<FakeCsvImport> & {
        mapping?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        stagedRows?: Prisma.InputJsonValue | typeof Prisma.DbNull;
        summary?: Prisma.InputJsonValue;
      };
      where: {
        id: string;
      };
    }): Promise<FakeCsvImport> => {
      const csvImport = this.csvImports.get(input.where.id);

      if (csvImport === undefined) {
        throw new Error("Fake import not found");
      }

      Object.entries(input.data).forEach(([key, value]) => {
        const normalized = value === Prisma.DbNull ? null : value;

        if (normalized !== undefined) {
          Object.assign(csvImport, {
            [key]: normalized
          });
        }
      });

      return csvImport;
    },
    updateMany: async (input: {
      data: {
        mapping: typeof Prisma.DbNull;
        stagedRows: typeof Prisma.DbNull;
        status: string;
      };
      where: {
        completedAt: null;
        expiresAt: {
          lte: Date;
        };
        status: {
          not: string;
        };
      };
    }): Promise<{ count: number }> => {
      let count = 0;

      this.csvImports.forEach((csvImport) => {
        if (
          csvImport.completedAt === null
          && csvImport.expiresAt.getTime() <= input.where.expiresAt.lte.getTime()
          && csvImport.status !== input.where.status.not
        ) {
          csvImport.mapping = null;
          csvImport.stagedRows = null;
          csvImport.status = input.data.status;
          count += 1;
        }
      });

      return {
        count
      };
    }
  };

  readonly transaction = {
    createMany: async (input: {
      data: FakeImportedTransaction[];
    }): Promise<{ count: number }> => {
      this.importedTransactions.push(...input.data);

      return {
        count: input.data.length
      };
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
        ? {
            timezone: user.timezone
          }
        : null;
    }
  };

  async $transaction<T>(callback: (tx: FakePrismaService) => Promise<T>): Promise<T> {
    return callback(this);
  }
}

describe("ImportsService", () => {
  let prisma: FakePrismaService;
  let service: ImportsService;

  beforeEach(() => {
    prisma = new FakePrismaService();
    service = new ImportsService(prisma as unknown as PrismaService);
    seedUser(prisma, "user-1", "Asia/Jakarta");
    seedUser(prisma, "user-2", "UTC");
    seedAccount(prisma, "account-1", "user-1", "IDR", "1000.0000");
    seedAccount(prisma, "account-other", "user-2", "IDR", "1000.0000");
  });

  it("uploads a UTF-8 comma CSV with BOM and exposes detected columns only", async () => {
    const response = await service.uploadCsv("user-1", csvFile(
      "\uFEFFdate,amount,description,private\n2026-06-02,-125.50,\"Lunch, team\",secret"
    ));

    expect(response.detectedColumns).toEqual(["date", "amount", "description", "private"]);
    expect(response.rowCount).toBe(1);
    expect(response.status).toBe("mapping_required");
    expect(prisma.csvImports.get(response.importId)?.stagedRows).not.toBeNull();
  });

  it("detects semicolon CSV files deterministically", async () => {
    const response = await service.uploadCsv("user-1", csvFile(
      "date;amount;description\n2026-06-02;-10.00;Lunch"
    ));

    expect(response.detectedColumns).toEqual(["date", "amount", "description"]);
  });

  it("rejects duplicate headers", async () => {
    await expect(service.uploadCsv("user-1", csvFile(
      "date,Amount,amount\n2026-06-02,1,2"
    ))).rejects.toThrow("CSV headers must be unique");
  });

  it("rejects non-UTF-8 uploads", async () => {
    const buffer = Buffer.from([0xc3, 0x28]);

    await expect(service.uploadCsv("user-1", {
      buffer,
      mimetype: "text/csv",
      originalname: "invalid.csv",
      size: buffer.byteLength
    })).rejects.toThrow("CSV file must use UTF-8 encoding");
  });

  it("rejects uploads larger than one MiB", async () => {
    const buffer = Buffer.alloc(maxCsvFileBytes + 1, "a");

    await expect(service.uploadCsv("user-1", {
      buffer,
      mimetype: "text/csv",
      originalname: "large.csv",
      size: buffer.byteLength
    })).rejects.toThrow("CSV file must not exceed 1 MiB");
  });

  it("rejects uploads with more than one thousand rows", async () => {
    const rows = Array.from({
      length: 1001
    }, (_value, index) => `2026-06-02,${index + 1}`).join("\n");

    await expect(service.uploadCsv("user-1", csvFile(
      `date,amount\n${rows}`
    ))).rejects.toThrow("CSV file must not exceed 1000 data rows");
  });

  it("rejects uploads with more than fifty columns", async () => {
    const columns = Array.from({
      length: 51
    }, (_value, index) => `column-${index + 1}`);

    await expect(service.uploadCsv("user-1", csvFile(
      `${columns.join(",")}\n${columns.map(() => "value").join(",")}`
    ))).rejects.toThrow("CSV file must include between 1 and 50 columns");
  });

  it("previews normalized rows without exposing unselected columns", async () => {
    const upload = await service.uploadCsv("user-1", csvFile(
      "date,amount,description,private\n2026-06-02,-125.50,  Lunch  ,secret\n2026-06-02T03:00:00+07:00,300,Salary,secret"
    ));
    const preview = await service.previewImport("user-1", upload.importId, previewInput());

    expect(preview.status).toBe("ready_to_import");
    expect(preview.summary).toMatchObject({
      expenseRowCount: 1,
      incomeRowCount: 1,
      invalidRowCount: 0,
      totalRowCount: 2,
      validRowCount: 2
    });
    expect(preview.rows[0]).toMatchObject({
      amount: "125.5000",
      currency: "IDR",
      errors: [],
      merchant: "Lunch",
      transactionAt: "2026-06-01T17:00:00.000Z",
      type: "expense"
    });
    expect(JSON.stringify(preview)).not.toContain("private");
    expect(JSON.stringify(preview)).not.toContain("secret");
  });

  it("shows safe row errors for zero amounts and ambiguous dates", async () => {
    const upload = await service.uploadCsv("user-1", csvFile(
      "date,amount\n01/02/2026,0"
    ));
    const preview = await service.previewImport("user-1", upload.importId, {
      accountId: "account-1",
      amountSignConvention: "positive_income",
      mapping: {
        amount: "amount",
        transactionAt: "date"
      }
    });

    expect(preview.status).toBe("validation_failed");
    expect(preview.summary.invalidRowCount).toBe(1);
    expect(preview.rows[0]?.errors.map((error) => error.code)).toEqual([
      "INVALID_DATE",
      "ZERO_AMOUNT"
    ]);
    expect(JSON.stringify(preview)).not.toContain("01/02/2026");
  });

  it("rejects locale-formatted amounts and merchants longer than the limit", async () => {
    const upload = await service.uploadCsv("user-1", csvFile(
      `date;amount;merchant\n2026-06-02;1,000;${"x".repeat(121)}`
    ));
    const preview = await service.previewImport("user-1", upload.importId, {
      accountId: "account-1",
      amountSignConvention: "positive_income",
      mapping: {
        amount: "amount",
        merchant: "merchant",
        transactionAt: "date"
      }
    });

    expect(preview.rows[0]?.errors.map((error) => error.code)).toEqual([
      "INVALID_AMOUNT",
      "MERCHANT_TOO_LONG"
    ]);
  });

  it("supports positive-expense convention", async () => {
    const upload = await service.uploadCsv("user-1", csvFile(
      "date,amount\n2026-06-02,25"
    ));
    const preview = await service.previewImport("user-1", upload.importId, {
      accountId: "account-1",
      amountSignConvention: "positive_expense",
      mapping: {
        amount: "amount",
        transactionAt: "date"
      }
    });

    expect(preview.rows[0]?.type).toBe("expense");
  });

  it("confirms atomically as import ledger rows and returns completed summary on retry", async () => {
    const upload = await service.uploadCsv("user-1", csvFile(
      "date,amount,description\n2026-06-02,-125.50,Lunch\n2026-06-03,300,Salary"
    ));
    await service.previewImport("user-1", upload.importId, previewInput());

    const first = await service.confirmImport("user-1", upload.importId);
    const second = await service.confirmImport("user-1", upload.importId);

    expect(first.status).toBe("completed");
    expect(second.summary.importedRowCount).toBe(2);
    expect(prisma.importedTransactions).toHaveLength(2);
    expect(prisma.importedTransactions[0]).toMatchObject({
      accountId: "account-1",
      currency: "IDR",
      importId: upload.importId,
      importRowNumber: 2,
      merchant: "Lunch",
      source: "import",
      type: "expense",
      userId: "user-1"
    });
    expect(prisma.importedTransactions[0]).not.toHaveProperty("categoryId");
    expect(prisma.importedTransactions[0]?.note).toBeUndefined();
    expect(prisma.importedTransactions[0]?.transferGroupId).toBeUndefined();
    expect(prisma.importedTransactions[0]?.recurringRuleId).toBeUndefined();
    expect(prisma.accounts.get("account-1")?.currentBalance.toFixed(4)).toBe("1174.5000");
    expect(prisma.csvImports.get(upload.importId)?.stagedRows).toBeNull();
    expect(prisma.csvImports.get(upload.importId)?.mapping).toBeNull();
    expect(prisma.auditEvents).toEqual([
      {
        entityId: upload.importId,
        entityType: "import",
        eventType: "csv_import_confirm",
        metadata: {
          expenseRowCount: 1,
          importedRowCount: 2,
          incomeRowCount: 1
        },
        userId: "user-1"
      }
    ]);
  });

  it("rejects cross-user import access", async () => {
    const upload = await service.uploadCsv("user-1", csvFile(
      "date,amount\n2026-06-02,25"
    ));

    await expect(service.previewImport("user-2", upload.importId, {
      accountId: "account-other",
      amountSignConvention: "positive_income",
      mapping: {
        amount: "amount",
        transactionAt: "date"
      }
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects confirmation when the destination account becomes unavailable", async () => {
    const upload = await service.uploadCsv("user-1", csvFile(
      "date,amount\n2026-06-02,25"
    ));
    await service.previewImport("user-1", upload.importId, {
      accountId: "account-1",
      amountSignConvention: "positive_income",
      mapping: {
        amount: "amount",
        transactionAt: "date"
      }
    });
    const account = prisma.accounts.get("account-1");

    if (account === undefined) {
      throw new Error("Seeded account missing");
    }

    account.archivedAt = new Date();

    await expect(service.confirmImport("user-1", upload.importId))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.importedTransactions).toHaveLength(0);
    expect(account.currentBalance.toFixed(4)).toBe("1000.0000");
  });

  it("expires staged rows and mapping after the retention window", async () => {
    const now = new Date("2026-06-02T00:00:00.000Z");
    const upload = await service.uploadCsv("user-1", csvFile(
      "date,amount\n2026-06-02,25"
    ), now);
    await service.previewImport("user-1", upload.importId, {
      accountId: "account-1",
      amountSignConvention: "positive_income",
      mapping: {
        amount: "amount",
        transactionAt: "date"
      }
    }, now);

    expect(await service.cleanupExpiredImports(new Date("2026-06-03T00:00:00.001Z"))).toBe(1);
    expect(prisma.csvImports.get(upload.importId)).toMatchObject({
      mapping: null,
      stagedRows: null,
      status: "expired"
    });
  });
});

function previewInput(): PreviewCsvImportDto {
  return {
    accountId: "account-1",
    amountSignConvention: "positive_income",
    mapping: {
      amount: "amount",
      merchant: "description",
      transactionAt: "date"
    }
  };
}

function csvFile(contents: string): CsvImportUploadFile {
  const buffer = Buffer.from(contents, "utf8");

  return {
    buffer,
    mimetype: "text/csv",
    originalname: "statement.csv",
    size: buffer.byteLength
  };
}

function seedUser(prisma: FakePrismaService, id: string, timezone: string): void {
  prisma.users.set(id, {
    deletedAt: null,
    id,
    status: "active",
    timezone
  });
}

function seedAccount(
  prisma: FakePrismaService,
  id: string,
  userId: string,
  currency: string,
  balance: string
): void {
  prisma.accounts.set(id, {
    archivedAt: null,
    currency,
    currentBalance: new Prisma.Decimal(balance),
    deletedAt: null,
    id,
    userId
  });
}

function matchesSimple<TRecord extends Record<string, unknown>>(
  record: TRecord,
  where: Partial<TRecord>
): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) {
      return true;
    }

    const recordValue = record[key];

    if (typeof value === "object" && value !== null && !(value instanceof Date)) {
      if ("lte" in value && value.lte instanceof Date && recordValue instanceof Date) {
        return recordValue.getTime() <= value.lte.getTime();
      }

      if ("not" in value) {
        return recordValue !== value.not;
      }
    }

    return recordValue === value;
  });
}
