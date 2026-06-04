import { describe, expect, it, vi } from "vitest";
import { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { ExportsController } from "./exports.controller";
import { ExportsService } from "./exports.service";

describe("ExportsController", () => {
  it("sets privacy-safe CSV download headers", async () => {
    const downloadExport = vi.fn(async () => ({
      contents: "transaction_id\n",
      filename: "money-tracker-transactions.csv",
      rowCount: 1
    }));
    const controller = new ExportsController({
      downloadExport
    } as unknown as ExportsService);
    const response = {
      setHeader: vi.fn()
    };
    const user: AuthenticatedUser = {
      email: "user@example.com",
      sessionId: "session-1",
      userId: "user-1"
    };

    const contents = await controller.download(user, "export-1", "signed-token", response);

    expect(contents).toBe("transaction_id\n");
    expect(downloadExport).toHaveBeenCalledWith("user-1", "export-1", "signed-token");
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv; charset=utf-8");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      "attachment; filename=\"money-tracker-transactions.csv\""
    );
  });
});
