// Whole lira everywhere, no kuruş — see PROJECT.md "Money Formatting".
export function lira(amount: number): string {
  return `₺${Math.round(amount).toLocaleString('en-US')}`
}
