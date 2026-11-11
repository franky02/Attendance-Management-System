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

export function fmtWeighted(hours: number | null | undefined): string {
  const w = weighted(hours)
  return w == null ? '' : fmtNumber(w)
}
