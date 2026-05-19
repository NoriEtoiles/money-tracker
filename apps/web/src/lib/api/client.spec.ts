import { describe, expect, it } from "vitest";
import { createApiUrl } from "./client";

describe("createApiUrl", () => {
  it("joins the configured API base URL with a path", () => {
    expect(createApiUrl("/health")).toBe("http://localhost:3001/api/v1/health");
    expect(createApiUrl("health")).toBe("http://localhost:3001/api/v1/health");
  });
});
