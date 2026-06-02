export const recurringFrequencies = ["daily", "weekly", "monthly"] as const;

export type RecurringFrequency = typeof recurringFrequencies[number];
