export const accountTypes = [
  "cash",
  "bank",
  "e_wallet",
  "credit_card",
  "debt",
  "investment"
] as const;

export type AccountType = (typeof accountTypes)[number];
