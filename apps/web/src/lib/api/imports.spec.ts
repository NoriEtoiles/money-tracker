import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadCsvImport } from "./imports";

describe("uploadCsvImport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses FormData without manually setting multipart content type", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toEqual({
        "Authorization": "Bearer token"
      });
      expect(init?.body).toBeInstanceOf(FormData);

      return new Response(JSON.stringify({
        detectedColumns: ["date", "amount"],
        expiresAt: "2026-06-03T00:00:00.000Z",
        filename: "statement.csv",
        importId: "import-id",
        rowCount: 1,
        status: "mapping_required"
      }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await uploadCsvImport("token", new Blob(["date,amount\n2026-06-02,10"], {
      type: "text/csv"
    }));

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
