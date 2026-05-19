export const transactionTypes = ["income", "expense"] as const;

export type TransactionType = typeof transactionTypes[number];
