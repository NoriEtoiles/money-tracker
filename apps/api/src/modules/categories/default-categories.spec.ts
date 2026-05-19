import { describe, expect, it } from "vitest";
import { defaultCategories } from "./default-categories";

describe("defaultCategories", () => {
  it("contains unique category names per kind", () => {
    const keys = defaultCategories.map((category) => `${category.kind}:${category.name}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("includes income and expense defaults", () => {
    expect(defaultCategories.some((category) => category.kind === "income")).toBe(true);
    expect(defaultCategories.some((category) => category.kind === "expense")).toBe(true);
  });
});
