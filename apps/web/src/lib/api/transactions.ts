import { createApiUrl } from "./client";

export type TransactionType = "expense" | "income";

export type Transaction = {
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
  note: string | null;
  status: string;
  transactionAt: string;
  type: TransactionType;
};

export type TransactionListResponse = {
  items: Transaction[];
  nextCursor: string | null;
};

export type TransactionListFilters = {
  accountId?: string;
  categoryId?: string;
  cursor?: string;
  dateFrom?: string;
  dateTo?: string;
  maxAmount?: string;
  minAmount?: string;
  search?: string;
  type?: TransactionType;
};

export type CreateTransactionInput = {
  accountId: string;
  amount: string;
  categoryId?: string;
  currency: string;
  merchant?: string;
  note?: string;
  transactionAt: string;
  type: TransactionType;
};

export type UpdateTransactionInput = {
  accountId?: string;
  amount?: string;
  categoryId?: string | null;
  currency?: string;
  merchant?: string;
  note?: string;
  transactionAt?: string;
  type?: TransactionType;
};

export async function listTransactions(
  accessToken: string,
  filters: TransactionListFilters = {}
): Promise<TransactionListResponse> {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();

  return request<TransactionListResponse>(
    query.length > 0 ? `/transactions?${query}` : "/transactions",
    accessToken
  );
}

export async function createTransaction(
  accessToken: string,
  input: CreateTransactionInput
): Promise<Transaction> {
  return request<Transaction>("/transactions", accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function updateTransaction(
  accessToken: string,
  transactionId: string,
  input: UpdateTransactionInput
): Promise<Transaction> {
  return request<Transaction>(`/transactions/${transactionId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH"
  });
}

export async function deleteTransaction(
  accessToken: string,
  transactionId: string
): Promise<void> {
  await request<{ mode: "soft_deleted"; success: true }>(
    `/transactions/${transactionId}`,
    accessToken,
    {
      method: "DELETE"
    }
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
