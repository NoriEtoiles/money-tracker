import { describe, expect, it } from "vitest";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("returns an ok health payload", () => {
    const health = new HealthService().getHealth();

    expect(health.service).toBe("money-tracker-api");
    expect(health.status).toBe("ok");
    expect(Date.parse(health.timestamp)).not.toBeNaN();
  });
});
