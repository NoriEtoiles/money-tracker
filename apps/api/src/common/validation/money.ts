export const decimalAmountPattern = /^(0|[1-9]\d*)(\.\d{1,4})?$/;

export function isDecimalAmount(value: string): boolean {
  return decimalAmountPattern.test(value);
}
