import { describe, expect, it } from "vitest";
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  it("hashes and verifies passwords without storing raw values", async () => {
    const service = new PasswordService();
    const hash = await service.hashPassword("StrongPassword123!");

    expect(hash).not.toBe("StrongPassword123!");
    await expect(service.verifyPassword("StrongPassword123!", hash)).resolves.toBe(true);
    await expect(service.verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
