import { createApiUrl } from "./client";

export type DashboardCurrencySummary = {
  currency: string;
  monthlyExpense: string;
  monthlyIncome: string;
  netCashflow: string;
  totalBalance: string;
};

export type DashboardBudgetWarning = {
  amount: string;
  budgetId: string;
  category: {
    id: string;
    name: string;
  };
  currency: string;
  isThresholdExceeded: boolean;
  remainingAmount: string;
  spentAmount: string;
  spentPercentage: string;
  thresholdPercentage: string;
};

export type DashboardRecentTransaction = {
  account: {
    id: string;
    name: string;
  };
  amount: string;
  category: {
    id: string;
    name: string;
  } | null;
  currency: string;
  id: string;
  merchant: string | null;
  status: string;
  transactionAt: string;
  type: "expense" | "income";
};

export type DashboardResponse = {
  budgetSummary: {
    activeBudgetCount: number;
    thresholdExceededCount: number;
    warnings: DashboardBudgetWarning[];
  };
  periodEnd: string;
  periodStart: string;
  recentTransactions: DashboardRecentTransaction[];
  summaryByCurrency: DashboardCurrencySummary[];
};

export type DashboardFilters = {
  periodStart?: string;
  recentLimit?: number;
};

export async function getDashboard(
  accessToken: string,
  filters: DashboardFilters = {}
): Promise<DashboardResponse> {
  const searchParams = new URLSearchParams();

  if (filters.periodStart !== undefined) {
    searchParams.set("periodStart", filters.periodStart);
  }

  if (filters.recentLimit !== undefined) {
    searchParams.set("recentLimit", String(filters.recentLimit));
  }

  const query = searchParams.toString();

  return request<DashboardResponse>(
    query.length > 0 ? `/reports/dashboard?${query}` : "/reports/dashboard",
    accessToken
  );
}

async function request<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(createApiUrl(path), {
    ...init,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function getErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const body = await response.json() as { error?: { message?: string } };

    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}
