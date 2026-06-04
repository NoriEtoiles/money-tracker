import { afterEach, describe, expect, it, vi } from "vitest";
import { createCsvExport, downloadCsvExportBlob } from "./exports";

describe("exports API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses exportType and transactionType in the export request body", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toEqual({
        "Authorization": "Bearer token",
        "Content-Type": "application/json"
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        accountId: "account-1",
        currency: "IDR",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        exportType: "transactions_csv",
        transactionType: "expense"
      });

      return new Response(JSON.stringify({
        completedAt: null,
        createdAt: "2026-06-03T00:00:00.000Z",
        downloadUrl: "/exports/export-1/download?token=signed",
        expiresAt: "2026-06-03T00:15:00.000Z",
        exportId: "export-1",
        exportType: "transactions_csv",
        filename: "transactions.csv",
        filters: {
          transactionType: "expense"
        },
        rowCount: null,
        status: "ready"
      }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await createCsvExport("token", {
      accountId: "account-1",
      currency: "IDR",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      exportType: "transactions_csv",
      transactionType: "expense"
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/v1/exports", expect.objectContaining({
      method: "POST"
    }));
  });

  it("downloads CSV blobs with bearer auth and filename fallback from response headers", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toEqual({
        "Authorization": "Bearer token"
      });

      return new Response("transaction_id\ntransaction-1\n", {
        headers: {
          "Content-Disposition": "attachment; filename=\"transactions.csv\"",
          "Content-Type": "text/csv"
        },
        status: 200
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await downloadCsvExportBlob(
      "token",
      "/exports/export-1/download?token=signed",
      "fallback.csv"
    );

    expect(response.filename).toBe("transactions.csv");
    expect(await response.blob.text()).toBe("transaction_id\ntransaction-1\n");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/exports/export-1/download?token=signed",
      expect.objectContaining({
        method: "GET"
      })
    );
  });
});
