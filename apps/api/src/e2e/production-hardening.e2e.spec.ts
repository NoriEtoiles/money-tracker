import { PrismaClient } from "@prisma/client";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type ApiResponse<T = unknown> = {
  body: T;
  headers: Headers;
  status: number;
  text: string;
};

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  token?: string;
};

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
  };
};

type TestSession = {
  email: string;
  password: string;
  token: string;
  userId: string;
};

type AccountResponse = {
  currentBalance: string;
  id: string;
};

type CategoryResponse = {
  id: string;
};

type TransactionResponse = {
  id: string;
};

type TransferResponse = {
  transferGroupId: string;
};

type BudgetResponse = {
  id: string;
};

type CsvExportResponse = {
  downloadUrl: string | null;
  exportId: string;
  rowCount: number | null;
  status: string;
};

type DownloadUrlInspection = {
  hasExpectedPath: boolean;
  hasToken: boolean;
  isPresent: boolean;
};

type ApiErrorResponse = {
  error: {
    code: string;
    details: unknown[];
    message: string;
    requestId: string;
  };
};

const runId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const password = "CorrectHorseBattery123!";
const safeRequestIdPattern = /^[A-Za-z0-9._-]{1,64}$/;

let baseUrl = "";
let apiOutput = "";
let apiProcess: ChildProcess | undefined;
let prisma: PrismaClient | undefined;

describe("Step 15A API production hardening", () => {
  beforeAll(async () => {
    process.env.NODE_ENV ??= "test";
    process.env.API_PORT ??= "3001";
    process.env.WEB_ORIGIN ??= "http://localhost:3000";
    process.env.DATABASE_URL ??=
      "postgresql://money_tracker:money_tracker@localhost:5432/money_tracker?schema=public";
    process.env.JWT_ACCESS_SECRET ??= "local-e2e-secret-with-at-least-32-characters";
    process.env.JWT_ACCESS_EXPIRES_IN ??= "15m";
    process.env.REFRESH_TOKEN_TTL_DAYS ??= "30";

    prisma = new PrismaClient();
    baseUrl = `http://127.0.0.1:${await getAvailablePort()}/api/v1`;
    const child = spawn(process.execPath, ["dist/main.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        API_PORT: new URL(baseUrl).port,
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN,
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
        NODE_ENV: process.env.NODE_ENV,
        REFRESH_TOKEN_TTL_DAYS: process.env.REFRESH_TOKEN_TTL_DAYS,
        WEB_ORIGIN: process.env.WEB_ORIGIN
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    apiProcess = child;
    child.stdout.on("data", (chunk: Buffer) => {
      apiOutput += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      apiOutput += chunk.toString("utf8");
    });

    await waitForApi();
  });

  afterAll(async () => {
    try {
      await cleanupTestUsers();
      await prisma?.$disconnect();
    } finally {
      await stopApi();
    }
  });

  it("runs the core authenticated MVP API smoke flow", async () => {
    const user = await registerAndLogin("core");
    const checking = await createAccount(user.token, "Core Checking", "1000.0000");
    const savings = await createAccount(user.token, "Core Savings", "250.0000");
    const incomeCategory = await createCategory(user.token, "Core Income", "income");
    const expenseCategory = await createCategory(user.token, "Core Expense", "expense");

    const me = await request("/me", { token: user.token });
    expect(me.status).toBe(200);
    expect((me.body as { email: string }).email).toBe(user.email);

    const income = await request<TransactionResponse>("/transactions", {
      body: {
        accountId: checking.id,
        amount: "125.2500",
        categoryId: incomeCategory.id,
        currency: "IDR",
        merchant: "Core salary",
        note: "Core income note",
        transactionAt: "2026-06-13T09:00:00.000Z",
        type: "income"
      },
      method: "POST",
      token: user.token
    });
    expect(income.status).toBe(201);
    expect(income.body.id).toEqual(expect.any(String));

    const expense = await request<TransactionResponse>("/transactions", {
      body: {
        accountId: checking.id,
        amount: "45.5000",
        categoryId: expenseCategory.id,
        currency: "IDR",
        merchant: "Core groceries",
        note: "Core expense note",
        transactionAt: "2026-06-13T10:00:00.000Z",
        type: "expense"
      },
      method: "POST",
      token: user.token
    });
    expect(expense.status).toBe(201);
    expect(expense.body.id).toEqual(expect.any(String));

    const transfer = await request<TransferResponse>("/transfers", {
      body: {
        amount: "25.0000",
        fromAccountId: checking.id,
        note: "Core transfer note",
        toAccountId: savings.id,
        transactionAt: "2026-06-13T11:00:00.000Z"
      },
      method: "POST",
      token: user.token
    });
    expect(transfer.status).toBe(201);
    expect(transfer.body.transferGroupId).toEqual(expect.any(String));

    const budget = await request<BudgetResponse>("/budgets", {
      body: {
        amount: "100.0000",
        categoryId: expenseCategory.id,
        currency: "IDR",
        periodStart: "2026-06-01",
        thresholdPercentage: 80
      },
      method: "POST",
      token: user.token
    });
    expect(budget.status).toBe(201);
    expect(budget.body.id).toEqual(expect.any(String));

    const dashboard = await request<{ summaryByCurrency: unknown[] }>(
      "/reports/dashboard?periodStart=2026-06-01&recentLimit=5",
      { token: user.token }
    );
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.summaryByCurrency.length).toBeGreaterThan(0);

    const spending = await request<{ items: unknown[] }>(
      "/reports/spending?dateFrom=2026-06-01&dateTo=2026-06-30",
      { token: user.token }
    );
    expect(spending.status).toBe(200);
    expect(spending.body.items.length).toBeGreaterThan(0);

    const cashflow = await request<{ buckets: unknown[] }>(
      "/reports/cashflow?dateFrom=2026-06-01&dateTo=2026-06-30",
      { token: user.token }
    );
    expect(cashflow.status).toBe(200);
    expect(cashflow.body.buckets.length).toBeGreaterThan(0);

    const netWorth = await request<{ accounts: unknown[] }>("/reports/net-worth", {
      token: user.token
    });
    expect(netWorth.status).toBe(200);
    expect(netWorth.body.accounts.length).toBeGreaterThanOrEqual(2);

    const csvExport = await request<CsvExportResponse>("/exports", {
      body: {
        currency: "IDR",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        exportType: "transactions_csv"
      },
      method: "POST",
      token: user.token
    });
    expect(csvExport.status).toBe(201);
    expect(csvExport.body.exportId).toEqual(expect.any(String));
    const createdDownloadUrl = inspectDownloadUrl(
      csvExport.body.downloadUrl,
      csvExport.body.exportId
    );
    expect(createdDownloadUrl.isPresent).toBe(true);
    expect(createdDownloadUrl.hasExpectedPath).toBe(true);
    expect(createdDownloadUrl.hasToken).toBe(true);

    const exportStatus = await request<CsvExportResponse>(
      `/exports/${csvExport.body.exportId}`,
      { token: user.token }
    );
    expect(exportStatus.status).toBe(200);
    expect(exportStatus.body.exportId).toBe(csvExport.body.exportId);
    expect(exportStatus.body.status).toBe("ready");
    const statusDownloadUrl = inspectDownloadUrl(
      exportStatus.body.downloadUrl,
      exportStatus.body.exportId
    );
    expect(statusDownloadUrl.isPresent).toBe(true);
    expect(statusDownloadUrl.hasExpectedPath).toBe(true);
    expect(statusDownloadUrl.hasToken).toBe(true);

    const download = await request<string>(csvExport.body.downloadUrl ?? "", {
      token: user.token
    });
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toContain("text/csv");
    expect(download.headers.get("content-disposition")).toContain("attachment");
    const hasExpectedHeader = download.text.startsWith("transaction_id,transaction_at,transaction_type");
    const containsIncomeRow = download.text.includes(income.body.id);
    const containsExpenseRow = download.text.includes(expense.body.id);
    const containsUserIdColumn = download.text.includes("user_id");

    expect(hasExpectedHeader).toBe(true);
    expect(containsIncomeRow).toBe(true);
    expect(containsExpenseRow).toBe(true);
    expect(containsUserIdColumn).toBe(false);

    const profile = await request("/me", {
      body: {
        displayName: "Core User Updated",
        locale: "id-ID",
        timezone: "Asia/Jakarta"
      },
      method: "PATCH",
      token: user.token
    });
    expect(profile.status).toBe(200);

    const sessions = await request<{ items: unknown[] }>("/auth/sessions", {
      token: user.token
    });
    expect(sessions.status).toBe(200);
    expect(sessions.body.items.length).toBeGreaterThan(0);

    const deletionRequest = await request<{ request: { status: string } | null }>(
      "/me/deletion-request",
      {
        body: {
          confirmationPhrase: "DELETE MY ACCOUNT",
          currentPassword: user.password
        },
        method: "POST",
        token: user.token
      }
    );
    expect(deletionRequest.status).toBe(201);
    expect(deletionRequest.body.request?.status).toBe("pending");

    const auditEvents = await request<{ items: Array<{ eventType: string }> }>("/audit-events", {
      token: user.token
    });
    expect(auditEvents.status).toBe(200);
    expect(auditEvents.body.items.some((event) => event.eventType === "delete_account_request")).toBe(true);

    const logout = await request("/auth/logout", {
      method: "POST",
      token: user.token
    });
    expect(logout.status).toBe(201);

    const revoked = await request("/me", { token: user.token });
    expect(revoked.status).toBe(401);
    expect((revoked.body as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("denies representative cross-user access and downloads", async () => {
    const owner = await registerAndLogin("owner");
    const attacker = await registerAndLogin("attacker");
    const ownerAccount = await createAccount(owner.token, "Owner Account", "500.0000");
    const attackerAccount = await createAccount(attacker.token, "Attacker Account", "100.0000");
    const ownerIncomeCategory = await createCategory(owner.token, "Owner Income", "income");
    const ownerExpenseCategory = await createCategory(owner.token, "Owner Expense", "expense");
    const ownerTransaction = await createTransaction(
      owner.token,
      ownerAccount.id,
      ownerIncomeCategory.id,
      "income"
    );
    const ownerExport = await request<CsvExportResponse>("/exports", {
      body: {
        accountId: ownerAccount.id,
        exportType: "transactions_csv"
      },
      method: "POST",
      token: owner.token
    });
    expect(ownerExport.status).toBe(201);

    const accountPatch = await request(`/accounts/${ownerAccount.id}`, {
      body: {
        name: "Cross-user overwrite attempt"
      },
      method: "PATCH",
      token: attacker.token
    });
    expect(accountPatch.status).toBe(404);

    const transactionPatch = await request(`/transactions/${ownerTransaction.id}`, {
      body: {
        amount: "1.0000"
      },
      method: "PATCH",
      token: attacker.token
    });
    expect(transactionPatch.status).toBe(404);

    const transferCreate = await request("/transfers", {
      body: {
        amount: "1.0000",
        fromAccountId: attackerAccount.id,
        toAccountId: ownerAccount.id,
        transactionAt: "2026-06-13T12:00:00.000Z"
      },
      method: "POST",
      token: attacker.token
    });
    expect(transferCreate.status).toBe(404);

    const budgetCreate = await request("/budgets", {
      body: {
        amount: "50.0000",
        categoryId: ownerExpenseCategory.id,
        currency: "IDR",
        periodStart: "2026-06-01"
      },
      method: "POST",
      token: attacker.token
    });
    expect(budgetCreate.status).toBe(404);

    const exportStatus = await request(`/exports/${ownerExport.body.exportId}`, {
      token: attacker.token
    });
    expect(exportStatus.status).toBe(404);

    const exportDownload = await request(ownerExport.body.downloadUrl ?? "", {
      token: attacker.token
    });
    expect(exportDownload.status).toBe(404);
  });

  it("sanitizes audit metadata and export audit privacy fields", async () => {
    const user = await registerAndLogin("audit");
    const account = await createAccount(user.token, "Audit Account", "0.0000");
    const category = await createCategory(user.token, "Audit Income", "income");
    const otherUser = await registerAndLogin("other-export");
    const otherAccount = await createAccount(otherUser.token, "Other Account", "0.0000");
    const otherCategory = await createCategory(otherUser.token, "Other Income", "income");
    const userTransaction = await createTransaction(user.token, account.id, category.id, "income");
    const otherTransaction = await createTransaction(
      otherUser.token,
      otherAccount.id,
      otherCategory.id,
      "income"
    );

    await prisma?.auditEvent.create({
      data: {
        entityType: "user",
        eventType: "unsafe_metadata_probe",
        metadata: {
          changedFields: ["displayName", "email", "passwordHash"],
          filters: {
            accountId: account.id,
            currency: "IDR",
            dateFrom: "2026-06-01",
            rawUrl: "/exports/example/download?token=secret"
          },
          note: "sensitive note",
          password: "secret",
          rawUrl: "/exports/example/download?token=secret",
          rowCount: 2,
          status: "ready",
          token: "secret"
        },
        userId: user.userId
      }
    });

    const csvExport = await request<CsvExportResponse>("/exports", {
      body: {
        currency: "IDR",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        exportType: "transactions_csv"
      },
      method: "POST",
      token: user.token
    });
    expect(csvExport.status).toBe(201);

    const download = await request<string>(csvExport.body.downloadUrl ?? "", {
      token: user.token
    });
    expect(download.status).toBe(200);
    const containsUserRow = download.text.includes(userTransaction.id);
    const containsOtherUserRow = download.text.includes(otherTransaction.id);
    const containsUserIdColumn = download.text.includes("user_id");
    const containsOtherUserId = download.text.includes(otherUser.userId);

    expect(containsUserRow).toBe(true);
    expect(containsOtherUserRow).toBe(false);
    expect(containsUserIdColumn).toBe(false);
    expect(containsOtherUserId).toBe(false);

    const auditEvents = await request<{
      items: Array<{
        eventType: string;
        metadata: Record<string, unknown>;
      }>;
    }>("/audit-events?limit=20", {
      token: user.token
    });
    expect(auditEvents.status).toBe(200);

    const unsafeEvent = auditEvents.body.items.find((event) =>
      event.eventType === "unsafe_metadata_probe"
    );
    const unsafeMetadata = unsafeEvent?.metadata ?? {};
    const unsafeMetadataKeys = Object.keys(unsafeMetadata).sort();
    const changedFields = unsafeMetadata.changedFields;
    const filters = unsafeMetadata.filters;
    const hasExpectedMetadataKeys = JSON.stringify(unsafeMetadataKeys) === JSON.stringify([
      "changedFields",
      "filters",
      "rowCount",
      "status"
    ]);
    const hasSafeChangedFields = Array.isArray(changedFields) &&
      changedFields.length === 1 &&
      changedFields[0] === "displayName";
    const hasSafeFilters = isRecord(filters) &&
      Object.keys(filters).sort().join(",") === "currency,dateFrom" &&
      filters.currency === "IDR" &&
      filters.dateFrom === "2026-06-01";
    const hasSafePrimitiveMetadata = unsafeMetadata.rowCount === 2 &&
      unsafeMetadata.status === "ready";

    expect(hasExpectedMetadataKeys).toBe(true);
    expect(hasSafeChangedFields).toBe(true);
    expect(hasSafeFilters).toBe(true);
    expect(hasSafePrimitiveMetadata).toBe(true);

    const exportAuditEvents = auditEvents.body.items.filter((event) =>
      event.eventType === "csv_export_request" || event.eventType === "csv_export_download"
    );
    expect(exportAuditEvents.length).toBeGreaterThanOrEqual(2);
    for (const event of exportAuditEvents) {
      const serialized = JSON.stringify(event.metadata);
      const hasUnsafeExportMetadata = serialized.includes("token") ||
        serialized.includes("downloadUrl") ||
        serialized.includes("?token=") ||
        serialized.includes("user_id");

      expect(hasUnsafeExportMetadata).toBe(false);
    }
  });

  it("returns the standard error shape for invalid input", async () => {
    const user = await registerAndLogin("invalid-input");
    const response = await request<ApiErrorResponse>("/accounts", {
      body: {
        currency: "IDR",
        extra: "forbidden",
        initialBalance: "10.0000",
        name: "Invalid Account",
        type: "cash"
      },
      method: "POST",
      token: user.token
    });

    expect(response.status).toBe(400);
    const responseRequestId = response.headers.get("x-request-id");

    expect(responseRequestId).toEqual(expect.stringMatching(safeRequestIdPattern));
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        details: expect.any(Array),
        message: expect.any(String),
        requestId: responseRequestId
      }
    });
  });

  it("generates request IDs for successful responses", async () => {
    const response = await request("/health");
    const requestId = response.headers.get("x-request-id");

    expect(response.status).toBe(200);
    expect(requestId).toEqual(expect.stringMatching(/^req_[A-Za-z0-9._-]+$/));
  });

  it("preserves safe inbound request IDs", async () => {
    const inboundRequestId = `client-${runId}`;
    const response = await request("/health", {
      headers: {
        Origin: "http://localhost:3000",
        "X-Request-Id": inboundRequestId
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe(inboundRequestId);
    expect(response.headers.get("access-control-expose-headers")).toContain("X-Request-Id");
  });

  it("replaces unsafe inbound request IDs", async () => {
    const unsafeRequestIds = [
      "bad /token?x=1",
      "a".repeat(65)
    ];

    for (const unsafeRequestId of unsafeRequestIds) {
      const response = await request("/health", {
        headers: {
          "X-Request-Id": unsafeRequestId
        }
      });
      const responseRequestId = response.headers.get("x-request-id");

      expect(response.status).toBe(200);
      expect(responseRequestId).not.toBe(unsafeRequestId);
      expect(responseRequestId).toEqual(expect.stringMatching(/^req_[A-Za-z0-9._-]+$/));
    }
  });

  it("uses the same safe request ID in error headers and bodies", async () => {
    const user = await registerAndLogin("request-id-error");
    const inboundRequestId = `error-${runId}`;
    const response = await request<ApiErrorResponse>("/accounts", {
      body: {
        currency: "IDR",
        extra: "forbidden",
        initialBalance: "10.0000",
        name: "Invalid Account",
        type: "cash"
      },
      headers: {
        "X-Request-Id": inboundRequestId
      },
      method: "POST",
      token: user.token
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBe(inboundRequestId);
    expect(response.body.error.requestId).toBe(inboundRequestId);
  });
});

async function request<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token !== undefined) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const body = text.length > 0 && contentType.includes("application/json")
    ? JSON.parse(text) as T
    : text as T;

  return {
    body,
    headers: response.headers,
    status: response.status,
    text
  };
}

function inspectDownloadUrl(
  downloadUrl: string | null,
  exportId: string
): DownloadUrlInspection {
  if (downloadUrl === null) {
    return {
      hasExpectedPath: false,
      hasToken: false,
      isPresent: false
    };
  }

  try {
    const parsed = new URL(downloadUrl, "http://127.0.0.1");

    return {
      hasExpectedPath: parsed.pathname === `/exports/${exportId}/download`,
      hasToken: (parsed.searchParams.get("token") ?? "").length > 0,
      isPresent: true
    };
  } catch {
    return {
      hasExpectedPath: false,
      hasToken: false,
      isPresent: true
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (typeof address !== "object" || address === null) {
        server.close();
        reject(new Error("Unable to allocate an E2E API port"));
        return;
      }

      server.close(() => resolve(address.port));
    });
  });
}

async function waitForApi(): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30000) {
    if (apiProcess?.exitCode !== null && apiProcess?.exitCode !== undefined) {
      throw new Error(`E2E API process exited early:\n${apiOutput}`);
    }

    try {
      const health = await fetch(`${baseUrl}/health`);

      if (health.status === 200) {
        return;
      }
    } catch {
      // The child process is still starting.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for E2E API to start:\n${apiOutput}`);
}

async function stopApi(): Promise<void> {
  if (apiProcess === undefined || apiProcess.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    apiProcess?.once("exit", () => resolve());
    apiProcess?.kill();
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function registerAndLogin(label: string): Promise<TestSession> {
  const email = `${label}.${runId}@example.test`;
  const register = await request<{ userId: string }>("/auth/register", {
    body: {
      displayName: `${label} user`,
      email,
      password
    },
    method: "POST"
  });
  expect(register.status).toBe(201);

  const login = await request<LoginResponse>("/auth/login", {
    body: {
      email,
      password
    },
    method: "POST"
  });
  expect(login.status).toBe(201);

  return {
    email,
    password,
    token: login.body.accessToken,
    userId: login.body.user.id
  };
}

async function createAccount(
  token: string,
  name: string,
  initialBalance: string
): Promise<AccountResponse> {
  const response = await request<AccountResponse>("/accounts", {
    body: {
      currency: "IDR",
      initialBalance,
      name,
      type: "cash"
    },
    method: "POST",
    token
  });
  expect(response.status).toBe(201);

  return response.body;
}

async function createCategory(
  token: string,
  name: string,
  kind: "expense" | "income"
): Promise<CategoryResponse> {
  const response = await request<CategoryResponse>("/categories", {
    body: {
      kind,
      name
    },
    method: "POST",
    token
  });
  expect(response.status).toBe(201);

  return response.body;
}

async function createTransaction(
  token: string,
  accountId: string,
  categoryId: string,
  type: "expense" | "income"
): Promise<TransactionResponse> {
  const response = await request<TransactionResponse>("/transactions", {
    body: {
      accountId,
      amount: "10.0000",
      categoryId,
      currency: "IDR",
      transactionAt: "2026-06-13T10:00:00.000Z",
      type
    },
    method: "POST",
    token
  });
  expect(response.status).toBe(201);

  return response.body;
}

async function cleanupTestUsers(): Promise<void> {
  if (prisma === undefined) {
    return;
  }

  const users = await prisma.user.findMany({
    select: {
      id: true
    },
    where: {
      email: {
        contains: runId
      }
    }
  });
  const userIds = users.map((user) => user.id);

  if (userIds.length === 0) {
    return;
  }

  await prisma.transaction.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.budget.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.recurringRule.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.csvImport.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.csvExport.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.accountDeletionRequest.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.session.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.auditEvent.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.tag.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.category.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.account.deleteMany({
    where: {
      userId: {
        in: userIds
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: userIds
      }
    }
  });
}
