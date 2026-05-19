import { createApiUrl } from "./client";

export type Account = {
  archivedAt: string | null;
  currency: string;
  currentBalance: string;
  id: string;
  includeInNetWorth: boolean;
  initialBalance: string;
  institutionName: string | null;
  name: string;
  sortOrder: number;
  type: string;
};

export type AccountListResponse = {
  items: Account[];
};

export type CreateAccountInput = {
  currency: string;
  includeInNetWorth: boolean;
  initialBalance: string;
  institutionName?: string;
  name: string;
  sortOrder: number;
  type: string;
};

export type UpdateAccountInput = {
  includeInNetWorth?: boolean;
  institutionName?: string;
  name?: string;
  sortOrder?: number;
};

export async function listAccounts(accessToken: string): Promise<AccountListResponse> {
  return request<AccountListResponse>("/accounts", accessToken);
}

export async function createAccount(
  accessToken: string,
  input: CreateAccountInput
): Promise<Account> {
  return request<Account>("/accounts", accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function updateAccount(
  accessToken: string,
  accountId: string,
  input: UpdateAccountInput
): Promise<Account> {
  return request<Account>(`/accounts/${accountId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH"
  });
}

export async function archiveAccount(accessToken: string, accountId: string): Promise<void> {
  await request<{ success: true }>(`/accounts/${accountId}`, accessToken, {
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
