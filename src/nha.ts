// National Holiday Allowance (NHA) rules.
// On an NH date: P, R (Rest) and CR (Compensatory Rest) are Eligible.
// NH (holiday availed), A, and every other leave type are Not Eligible.
// A blank cell is "Not marked": not counted, and flagged so it gets fixed in the muster first.
import { key, type Marks, type RosterEntry } from './types'

export type NhResult = 'eligible' | 'ineligible' | 'unmarked'

export const NH_CODE = 'NH'
const ELIGIBLE = new Set(['P', 'R', 'CR'])

export function nhResult(code: string | undefined): NhResult {
  if (!code) return 'unmarked'
  return ELIGIBLE.has(code) ? 'eligible' : 'ineligible'
}

/** Words for the Remarks column (used when the month has a single NH). */
export function nhRemark(code: string | undefined): string {
  switch (code) {
    case undefined: case '': return 'Not marked'
    case 'P': return 'Present'
    case 'R': return 'Rest'
    case 'CR': return 'CR'
    case 'A': return 'Absent'
    case NH_CODE: return 'NH Availed'
    default: return code
  }
}

export interface NhaRow {
  entry: RosterEntry
  results: { date: string; code: string | undefined; result: NhResult }[]
  count: number // eligible NH days
}

export function nhaRows(dates: string[], roster: RosterEntry[], marks: Marks): NhaRow[] {
  return roster.map((entry) => {
    const results = dates.map((date) => {
      const code = marks[key(entry.employee_id, date)]
      return { date, code, result: nhResult(code) }
    })
    return { entry, results, count: results.filter((r) => r.result === 'eligible').length }
  })
}

/** "03", or "--" for none, as on the paper statement. */
export function nhaCount(n: number): string {
  return n ? String(n).padStart(2, '0') : '--'
}
