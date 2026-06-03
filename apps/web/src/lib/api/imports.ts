import { createApiUrl } from "./client";

export type AmountSignConvention = "positive_expense" | "positive_income";

export type CsvImportSummary = {
  expenseRowCount: number;
  importedRowCount: number;
  incomeRowCount: number;
  invalidRowCount: number;
  totalRowCount: number;
  validRowCount: number;
};

export type CsvImportHistoryItem = {
  completedAt: string | null;
  createdAt: string;
  expiresAt: string;
  filename: string;
  id: string;
  status: string;
  summary: CsvImportSummary;
};

export type CsvImportHistoryListResponse = {
  items: CsvImportHistoryItem[];
  nextCursor: string | null;
};

export type CsvImportUploadResponse = {
  detectedColumns: string[];
  expiresAt: string;
  filename: string;
  importId: string;
  rowCount: number;
  status: "mapping_required";
};

export type CsvImportRowError = {
  code: string;
  field: "amount" | "merchant" | "transactionAt";
  message: string;
};

export type CsvImportPreviewRow = {
  amount: string | null;
  currency: string;
  errors: CsvImportRowError[];
  merchant: string | null;
  rowNumber: number;
  transactionAt: string | null;
  type: "expense" | "income" | null;
};

export type CsvImportPreviewResponse = {
  importId: string;
  rows: CsvImportPreviewRow[];
  status: "ready_to_import" | "validation_failed";
  summary: CsvImportSummary;
};

export type PreviewCsvImportInput = {
  accountId: string;
  amountSignConvention: AmountSignConvention;
  mapping: {
    amount: string;
    merchant?: string;
    transactionAt: string;
  };
};

export async function uploadCsvImport(
  accessToken: string,
  file: Blob
): Promise<CsvImportUploadResponse> {
  const body = new FormData();

  body.append("file", file);

  const response = await fetch(createApiUrl("/imports/csv"), {
    body,
    headers: {
      "Authorization": `Bearer ${accessToken}`
    },
    method: "POST"
  });

  return readResponse<CsvImportUploadResponse>(response);
}

export async function previewCsvImport(
  accessToken: string,
  importId: string,
  input: PreviewCsvImportInput
): Promise<CsvImportPreviewResponse> {
  return request<CsvImportPreviewResponse>(`/imports/${importId}/preview`, accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function confirmCsvImport(
  accessToken: string,
  importId: string
): Promise<CsvImportHistoryItem> {
  return request<CsvImportHistoryItem>(`/imports/${importId}/confirm`, accessToken, {
    method: "POST"
  });
}

export async function listCsvImports(
  accessToken: string
): Promise<CsvImportHistoryListResponse> {
  return request<CsvImportHistoryListResponse>("/imports", accessToken);
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

  return readResponse<T>(response);
}

async function readResponse<T>(response: Response): Promise<T> {
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
