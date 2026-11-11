// Night Duty (NDA statement) rules: hours per person per period; Weighted Hrs. = hours ÷ 6.
export const DEFAULT_ROSTER = 'Cont.'
export const WEIGHT_DIVISOR = 6
export const MAX_HOURS = 744 // 31 nights × 24 h, a sanity limit for typing mistakes

/** "12" → 12, "7.5" → 7.5, "" → null, anything else → undefined (invalid). */
export function parseHours(text: string): number | null | undefined {
  const t = text.trim()
  if (!t) return null
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined
  const n = Number(t)
  return n <= MAX_HOURS ? n : undefined
}

/** Whole numbers print plain; otherwise 2 decimals. */
export function fmtNumber(n: number): string {
  const r = Math.round(n * 100) / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

export function weighted(hours: number | null | undefined): number | null {
  return hours == null ? null : hours / WEIGHT_DIVISOR
}

/** Weighted hours as at least two digits and always two decimals: 6 → "06.00", 9.33 → "09.33", 11 → "11.00". */
export function fmtHoursPadded(n: number): string {
  const [whole, dec] = (Math.round(n * 100) / 100).toFixed(2).split('.')
  return `${whole.padStart(2, '0')}.${dec}`
}

export function fmtWeighted(hours: number | null | undefined): string {
  const w = weighted(hours)
  return w == null ? '' : fmtHoursPadded(w)
}
