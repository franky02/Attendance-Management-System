// Totals for the Absentees statement: from the period's 16th up to a chosen date.
import { periodDates, periodFor } from './dates'
import { key, type Marks, type RosterEntry } from './types'

/** The statement's columns and the codes behind them. */
export const ABSENTEE_COLUMNS = { lap: 'LAP', sick: 'S', cr: 'CR' } as const

export interface AbsenteeRow {
  entry: RosterEntry
  lap: number
  sick: number
  cr: number
}

export function absenteeRows(start: string, asOf: string, roster: RosterEntry[], marks: Marks): AbsenteeRow[] {
  const dates = periodDates(start).filter((d) => d <= asOf)
  return roster.map((entry) => {
    const row: AbsenteeRow = { entry, lap: 0, sick: 0, cr: 0 }
    for (const d of dates) {
      const s = marks[key(entry.employee_id, d)]
      if (s === ABSENTEE_COLUMNS.lap) row.lap++
      else if (s === ABSENTEE_COLUMNS.sick) row.sick++
      else if (s === ABSENTEE_COLUMNS.cr) row.cr++
    }
    return row
  })
}

/** Latest date a statement can cover: the period end, or today if earlier. */
export function maxAsOf(start: string, today: string): string {
  const { end } = periodFor(start)
  return end < today ? end : today
}

export function isFullPeriod(start: string, asOf: string): boolean {
  return asOf >= periodFor(start).end
}

