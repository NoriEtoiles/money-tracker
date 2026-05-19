import { createApiUrl } from "./client";

export type Transfer = {
  amount: string;
  currency: string;
  fromAccount: {
    id: string;
    name: string;
  };
  inflowTransactionId: string;
  note: string | null;
  outflowTransactionId: string;
  status: string;
  toAccount: {
    id: string;
    name: string;
  };
  transactionAt: string;
  transferGroupId: string;
};

export type TransferListResponse = {
  items: Transfer[];
  nextCursor: string | null;
};

export type TransferListFilters = {
  cursor?: string;
  limit?: number;
};

export type CreateTransferInput = {
  amount: string;
  fromAccountId: string;
  note?: string;
  toAccountId: string;
  transactionAt: string;
};

export type UpdateTransferInput = {
  amount?: string;
  fromAccountId?: string;
  note?: string;
  toAccountId?: string;
  transactionAt?: string;
};

export async function listTransfers(
  accessToken: string,
  filters: TransferListFilters = {}
): Promise<TransferListResponse> {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();

  return request<TransferListResponse>(
    query.length > 0 ? `/transfers?${query}` : "/transfers",
    accessToken
  );
}

export async function createTransfer(
  accessToken: string,
  input: CreateTransferInput
): Promise<Transfer> {
  return request<Transfer>("/transfers", accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function updateTransfer(
  accessToken: string,
  transferGroupId: string,
  input: UpdateTransferInput
): Promise<Transfer> {
  return request<Transfer>(`/transfers/${transferGroupId}`, accessToken, {
    body: JSON.stringify(input),
    method: "PATCH"
  });
}

export async function deleteTransfer(
  accessToken: string,
  transferGroupId: string
): Promise<void> {
  await request<{ mode: "soft_deleted"; success: true }>(
    `/transfers/${transferGroupId}`,
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
