import { createApiUrl } from "./client";

export type CsvExportType = "transactions_csv";
export type ExportTransactionType = "expense" | "income" | "transfer";

export type CsvExportFilters = {
  accountId?: string;
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
  transactionType?: ExportTransactionType;
};

export type CreateCsvExportInput = CsvExportFilters & {
  exportType: CsvExportType;
};

export type CsvExportItem = {
  completedAt: string | null;
  createdAt: string;
  downloadUrl: string | null;
  expiresAt: string;
  exportId: string;
  exportType: CsvExportType;
  filename: string;
  filters: CsvExportFilters;
  rowCount: number | null;
  status: string;
};

export type CsvExportListResponse = {
  items: CsvExportItem[];
  nextCursor: string | null;
};

export type CsvExportBlobDownload = {
  blob: Blob;
  filename: string;
};

export async function createCsvExport(
  accessToken: string,
  input: CreateCsvExportInput
): Promise<CsvExportItem> {
  return request<CsvExportItem>("/exports", accessToken, {
    body: JSON.stringify(input),
    method: "POST"
  });
}

export async function listCsvExports(accessToken: string): Promise<CsvExportListResponse> {
  return request<CsvExportListResponse>("/exports", accessToken);
}

export async function getCsvExport(
  accessToken: string,
  exportId: string
): Promise<CsvExportItem> {
  return request<CsvExportItem>(`/exports/${exportId}`, accessToken);
}

export async function downloadCsvExportBlob(
  accessToken: string,
  downloadUrl: string,
  fallbackFilename: string
): Promise<CsvExportBlobDownload> {
  const response = await fetch(createApiUrl(downloadUrl), {
    headers: {
      "Authorization": `Bearer ${accessToken}`
    },
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return {
    blob: await response.blob(),
    filename: getContentDispositionFilename(response.headers.get("Content-Disposition")) ?? fallbackFilename
  };
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

function getContentDispositionFilename(header: string | null): string | null {
  if (header === null) {
    return null;
  }

  const match = /filename="([^"]+)"/.exec(header);

  return match?.[1] ?? null;
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
