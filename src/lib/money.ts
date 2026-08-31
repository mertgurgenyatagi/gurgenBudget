/** TRY, whole lira, everywhere. No kuruş, no decimals — hard-coded, not a setting. */
const GROUPED = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })

/** ₺1.234 — signed, for figures where direction matters. */
export function money(amount: number): string {
  const whole = Math.round(amount)
  return whole < 0 ? `−₺${GROUPED.format(-whole)}` : `₺${GROUPED.format(whole)}`
}

/** ₺1.234 — never signed. The daily log shows spend without minus signs. */
export function moneyAbs(amount: number): string {
  return `₺${GROUPED.format(Math.abs(Math.round(amount)))}`
}

/** Bare grouped digits, no symbol. */
export function digits(amount: number): string {
  return GROUPED.format(Math.abs(Math.round(amount)))
}

/** Parse whatever was typed into a whole-lira number. Anything numeric is allowed. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(/,/g, '.')
  if (cleaned === '' || cleaned === '-') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? Math.round(value) : null
}
