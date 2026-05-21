import { createApiUrl } from "./client";

export type Budget = {
  amount: string;
  category: {
    id: string;
    name: string;
  };
  currency: string;
  id: string;
  isThresholdExceeded: boolean;
  periodEnd: string;
  periodStart: string;
  remainingAmount: string;
  spentAmount: string;
  spentPercentage: string;
  status: string;
  thresholdPercentage: string;
};

export type BudgetListResponse = {
  items: Budget[];
};

export type BudgetListFilters = {
  currency?: string;
  periodStart: string;
};

export type CreateBudgetInput = {
  amount: string;
  categoryId: string;
  currency: string;
  periodStart: string;
  thresholdPercentage?: number;
};

export type UpdateBudgetInput = Partial<CreateBudgetInput>;

export async function listBudgets(
  accessToken: string,
  filters: BudgetListFilters
): Promise<BudgetListResponse> {
  const searchParams = new URLSearchParams();

  searchParams.set("periodStart", filters.periodStart);

  if (filters.currency !== undefined && filters.currency.length > 0) {
    searchParams.set("currency", filters.currency);
  }

  return request<BudgetListResponse>(`/budgets?${searchParams.toString()}`, accessToken);
}

export async function createBudget(
  accessToken: string,
  input: CreateBudgetInput
): Promise<Budget> {
  return request<Budget>("/budgets", accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function updateBudget(
  accessToken: string,
  budgetId: string,
  input: UpdateBudgetInput
): Promise<Budget> {
  return request<Budget>(`/budgets/${budgetId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH"
  });
}

export async function archiveBudget(accessToken: string, budgetId: string): Promise<void> {
  await request<{ mode: "archived"; success: true }>(`/budgets/${budgetId}`, accessToken, {
    method: "DELETE"
  });
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
