// Totals for the Absentees statement: from the period's 16th up to a chosen date.
import { parts, periodDates, periodFor } from './dates'
import { key, type Marks, type RosterEntry } from './types'

/** The statement's columns and the codes behind them. */
export const ABSENTEE_COLUMNS = { lap: 'LAP', sick: 'S', cr: 'CR' } as const

export interface AbsenteeRow {
  entry: RosterEntry
  lap: number
  sick: number
  crDates: string[] // YYYY-MM-DD
}

export function absenteeRows(start: string, asOf: string, roster: RosterEntry[], marks: Marks): AbsenteeRow[] {
  const dates = periodDates(start).filter((d) => d <= asOf)
  return roster.map((entry) => {
    const row: AbsenteeRow = { entry, lap: 0, sick: 0, crDates: [] }
    for (const d of dates) {
      const s = marks[key(entry.employee_id, d)]
      if (s === ABSENTEE_COLUMNS.lap) row.lap++
      else if (s === ABSENTEE_COLUMNS.sick) row.sick++
      else if (s === ABSENTEE_COLUMNS.cr) row.crDates.push(d)
    }
    return row
  })
}

/** "18/10" */
export function dayMonth(date: string): string {
  const [, m, d] = parts(date)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

/** Latest date a statement can cover: the period end, or today if earlier. */
export function maxAsOf(start: string, today: string): string {
  const { end } = periodFor(start)
  return end < today ? end : today
}

export function isFullPeriod(start: string, asOf: string): boolean {
  return asOf >= periodFor(start).end
}

