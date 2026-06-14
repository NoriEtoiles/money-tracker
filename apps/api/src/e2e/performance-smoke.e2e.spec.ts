import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type ApiResponse<T = unknown> = {
  body: T;
  elapsedMs: number;
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

type CsvExportResponse = {
  downloadUrl: string | null;
  exportId: string;
  rowCount: number | null;
  status: string;
};

const runId = `perf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const password = "CorrectHorseBattery123!";
const endpointThresholdMs = readPositiveInteger("PERFORMANCE_SMOKE_MAX_ENDPOINT_MS", 5000);
const exportDownloadThresholdMs = readPositiveInteger(
  "PERFORMANCE_SMOKE_MAX_EXPORT_DOWNLOAD_MS",
  10000
);
const seedTransactionCount = readPositiveInteger(
  "PERFORMANCE_SMOKE_TRANSACTION_COUNT",
  1200
);

let baseUrl = "";
let apiOutput = "";
let apiProcess: ChildProcess | undefined;
let prisma: PrismaClient | undefined;
let user: TestSession | undefined;

describe("Step 15B local performance smoke", () => {
  beforeAll(async () => {
    process.env.NODE_ENV ??= "test";
    process.env.API_PORT ??= "3001";
    process.env.WEB_ORIGIN ??= "http://localhost:3000";
    process.env.DATABASE_URL ??=
      "postgresql://money_tracker:money_tracker@localhost:5432/money_tracker?schema=public";
    process.env.JWT_ACCESS_SECRET ??= "local-performance-secret-with-at-least-32-characters";
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
    user = await registerAndLogin();
    await seedSyntheticData(user.userId);
  }, 60000);

  afterAll(async () => {
    try {
      await cleanupTestUser();
      await prisma?.$disconnect();
    } finally {
      await stopApi();
    }
  });

  it("keeps core read endpoints within broad local smoke thresholds", async () => {
    const session = requireUser();
    const checks = [
      {
        path: "/transactions?dateFrom=2026-01-01&dateTo=2026-06-30&limit=50",
        status: 200
      },
      {
        path: "/reports/dashboard?periodStart=2026-06-01&recentLimit=10",
        status: 200
      },
      {
        path: "/reports/spending?dateFrom=2026-01-01&dateTo=2026-06-30",
        status: 200
      },
      {
        path: "/reports/cashflow?dateFrom=2026-01-01&dateTo=2026-06-30",
        status: 200
      },
      {
        path: "/reports/net-worth",
        status: 200
      }
    ];

    for (const check of checks) {
      const response = await request(check.path, { token: session.token });

      expect(response.status).toBe(check.status);
      expect(response.elapsedMs).toBeLessThanOrEqual(endpointThresholdMs);
    }
  }, 60000);

  it("keeps CSV export creation and moderate download within broad local smoke thresholds", async () => {
    const session = requireUser();
    const created = await request<CsvExportResponse>("/exports", {
      body: {
        dateFrom: "2026-01-01",
        dateTo: "2026-06-30",
        exportType: "transactions_csv"
      },
      method: "POST",
      token: session.token
    });

    expect(created.status).toBe(201);
    expect(created.elapsedMs).toBeLessThanOrEqual(endpointThresholdMs);
    expect(created.body.downloadUrl).toEqual(expect.any(String));

    const downloaded = await request<string>(created.body.downloadUrl ?? "", {
      token: session.token
    });

    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("content-type")).toContain("text/csv");
    expect(downloaded.elapsedMs).toBeLessThanOrEqual(exportDownloadThresholdMs);
    expect(downloaded.text).toContain("transaction_id,transaction_at,transaction_type");
  }, 60000);
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

  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method: options.method ?? "GET"
  });
  const elapsedMs = performance.now() - startedAt;
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const body = text.length > 0 && contentType.includes("application/json")
    ? JSON.parse(text) as T
    : text as T;

  return {
    body,
    elapsedMs,
    headers: response.headers,
    status: response.status,
    text
  };
}

async function registerAndLogin(): Promise<TestSession> {
  const email = `performance.${runId}@example.test`;
  const register = await request<{ userId: string }>("/auth/register", {
    body: {
      displayName: "Performance Smoke",
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

async function seedSyntheticData(userId: string): Promise<void> {
  if (prisma === undefined) {
    throw new Error("Prisma client is not ready");
  }

  const client = prisma;
  const accounts = await Promise.all(
    ["Cash", "Checking", "Savings"].map((name, index) =>
      client.account.create({
        data: {
          currentBalance: `${100000 + index * 25000}.0000`,
          currency: "IDR",
          initialBalance: `${100000 + index * 25000}.0000`,
          name: `${name} ${runId}`,
          sortOrder: index,
          type: index === 0 ? "cash" : "bank",
          userId
        }
      })
    )
  );
  const expenseCategories = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      client.category.create({
        data: {
          kind: "expense",
          name: `Expense ${index + 1} ${runId}`,
          sortOrder: index,
          userId
        }
      })
    )
  );
  const incomeCategories = await Promise.all(
    Array.from({ length: 2 }, (_, index) =>
      client.category.create({
        data: {
          kind: "income",
          name: `Income ${index + 1} ${runId}`,
          sortOrder: index,
          userId
        }
      })
    )
  );
  const periodStart = new Date(Date.UTC(2026, 5, 1));
  const periodEnd = new Date(Date.UTC(2026, 6, 1));

  await client.budget.createMany({
    data: expenseCategories.map((category, index) => ({
      amount: "5000.0000",
      categoryId: category.id,
      currency: "IDR",
      periodEnd,
      periodStart,
      thresholdPercentage: index % 3 === 0 ? "70.00" : "80.00",
      userId
    }))
  });

  await client.transaction.createMany({
    data: Array.from({ length: seedTransactionCount }, (_, index) => {
      const isIncome = index % 5 === 0;
      const month = index % 6;
      const day = index % 28 + 1;
      const account = accounts[index % accounts.length];
      const category = isIncome
        ? incomeCategories[index % incomeCategories.length]
        : expenseCategories[index % expenseCategories.length];

      return {
        accountId: account.id,
        amount: `${10 + index % 90}.0000`,
        categoryId: category.id,
        currency: "IDR",
        id: randomUUID(),
        merchant: null,
        note: null,
        transactionAt: new Date(Date.UTC(2026, month, day, index % 20, 0, 0)),
        type: isIncome ? "income" : "expense",
        userId
      };
    })
  });
}

function requireUser(): TestSession {
  if (user === undefined) {
    throw new Error("Performance smoke user is not ready");
  }

  return user;
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (typeof address !== "object" || address === null) {
        server.close();
        reject(new Error("Unable to allocate a performance API port"));
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
      throw new Error(`Performance API process exited early:\n${apiOutput}`);
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

  throw new Error(`Timed out waiting for performance API to start:\n${apiOutput}`);
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

async function cleanupTestUser(): Promise<void> {
  if (prisma === undefined || user === undefined) {
    return;
  }

  await prisma.transaction.deleteMany({
    where: {
      userId: user.userId
    }
  });
  await prisma.budget.deleteMany({
    where: {
      userId: user.userId
    }
  });
  await prisma.csvExport.deleteMany({
    where: {
      userId: user.userId
    }
  });
  await prisma.session.deleteMany({
    where: {
      userId: user.userId
    }
  });
  await prisma.auditEvent.deleteMany({
    where: {
      userId: user.userId
    }
  });
  await prisma.category.deleteMany({
    where: {
      userId: user.userId
    }
  });
  await prisma.account.deleteMany({
    where: {
      userId: user.userId
    }
  });
  await prisma.user.deleteMany({
    where: {
      id: user.userId
    }
  });
}
