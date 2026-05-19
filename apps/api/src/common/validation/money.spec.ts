import { describe, expect, it } from "vitest";
import { isDecimalAmount } from "./money";

describe("isDecimalAmount", () => {
  it("accepts non-negative decimal strings with up to four fraction digits", () => {
    expect(isDecimalAmount("0")).toBe(true);
    expect(isDecimalAmount("1000000")).toBe(true);
    expect(isDecimalAmount("1500000.1234")).toBe(true);
  });

  it("rejects floats and malformed money values", () => {
    expect(isDecimalAmount("-1")).toBe(false);
    expect(isDecimalAmount("1.12345")).toBe(false);
    expect(isDecimalAmount("01")).toBe(false);
    expect(isDecimalAmount("abc")).toBe(false);
  });
});
