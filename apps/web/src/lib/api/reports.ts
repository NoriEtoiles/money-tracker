import { createApiUrl } from "./client";

export type SpendingReportItem = {
  amount: string;
  category: {
    id: string;
    name: string;
  } | null;
  currency: string;
  percentage: string;
};

export type SpendingReportResponse = {
  dateFrom: string;
  dateTo: string;
  items: SpendingReportItem[];
  totalsByCurrency: Array<{
    currency: string;
    totalAmount: string;
  }>;
};

export type CashflowReportBucket = {
  currency: string;
  expenseAmount: string;
  incomeAmount: string;
  netCashflow: string;
  periodEnd: string;
  periodStart: string;
};

export type CashflowReportResponse = {
  buckets: CashflowReportBucket[];
  dateFrom: string;
  dateTo: string;
  grain: "month";
};

export type NetWorthAccount = {
  currentBalance: string;
  currency: string;
  id: string;
  name: string;
  sortOrder: number;
  type: string;
};

export type NetWorthReportResponse = {
  accounts: NetWorthAccount[];
  asOf: string;
  summaryByCurrency: Array<{
    accountCount: number;
    currency: string;
    totalBalance: string;
  }>;
};

export type DateRangeReportFilters = {
  currency?: string;
  dateFrom: string;
  dateTo: string;
};

export type NetWorthReportFilters = {
  currency?: string;
};

export async function getSpendingReport(
  accessToken: string,
  filters: DateRangeReportFilters
): Promise<SpendingReportResponse> {
  return request<SpendingReportResponse>(
    `/reports/spending?${toDateRangeSearchParams(filters).toString()}`,
    accessToken
  );
}

export async function getCashflowReport(
  accessToken: string,
  filters: DateRangeReportFilters
): Promise<CashflowReportResponse> {
  return request<CashflowReportResponse>(
    `/reports/cashflow?${toDateRangeSearchParams(filters).toString()}`,
    accessToken
  );
}

export async function getNetWorthReport(
  accessToken: string,
  filters: NetWorthReportFilters = {}
): Promise<NetWorthReportResponse> {
  const searchParams = new URLSearchParams();

  if (filters.currency !== undefined && filters.currency.length > 0) {
    searchParams.set("currency", filters.currency);
  }

  const query = searchParams.toString();

  return request<NetWorthReportResponse>(
    query.length > 0 ? `/reports/net-worth?${query}` : "/reports/net-worth",
    accessToken
  );
}

function toDateRangeSearchParams(filters: DateRangeReportFilters): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("dateFrom", filters.dateFrom);
  searchParams.set("dateTo", filters.dateTo);

  if (filters.currency !== undefined && filters.currency.length > 0) {
    searchParams.set("currency", filters.currency);
  }

  return searchParams;
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
