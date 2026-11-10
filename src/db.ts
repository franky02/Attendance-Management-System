import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { periodFor } from './dates'
import { demoDb } from './demoDb'
import type { AttendanceRow, Employee, PeriodRow, RosterEntry } from './types'

export interface Db {
  demo: boolean
  getEmployees(): Promise<Employee[]>
  saveEmployee(e: Omit<Employee, 'id'> & { id?: string }): Promise<Employee>
  getPeriods(): Promise<PeriodRow[]>
  /** insert … on conflict do nothing */
  ensurePeriod(row: Omit<PeriodRow, 'remarks' | 'final_downloaded_at'>): Promise<void>
  updatePeriod(start: string, patch: Partial<Pick<PeriodRow, 'roster' | 'remarks' | 'final_downloaded_at'>>): Promise<void>
  getAttendance(from: string, to: string): Promise<AttendanceRow[]>
  /** Insert or overwrite cells in one request. */
  upsertMarks(rows: AttendanceRow[]): Promise<void>
  /** Clear cells (a blank cell is a missing row) in one request. */
  deleteMarks(rows: { employee_id: string; att_date: string }[]): Promise<void>
  exportAll(): Promise<{ employee: Employee[]; period: PeriodRow[]; attendance: AttendanceRow[] }>
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null

/** Keeps demo data and each real project's data apart in the phone's storage. */
export const storageScope = supabase ? new URL(url!).hostname.split('.')[0] : 'demo'

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

const supabaseDb = (sb: SupabaseClient): Db => ({
  demo: false,
  async getEmployees() {
    return check(await sb.from('employee').select('*').order('display_order')) as Employee[]
  },
  async saveEmployee(e) {
    return check(await sb.from('employee').upsert(e).select().single()) as Employee
  },
  async getPeriods() {
    return check(await sb.from('period').select('*').order('start_date', { ascending: false })) as PeriodRow[]
  },
  async ensurePeriod(row) {
    check(await sb.from('period').upsert(row, { onConflict: 'start_date', ignoreDuplicates: true }))
  },
  async updatePeriod(start, patch) {
    check(await sb.from('period').update(patch).eq('start_date', start))
  },
  async getAttendance(from, to) {
    const rows: AttendanceRow[] = []
    // Page through in case a period ever exceeds the 1000-row default.
    for (let off = 0; ; off += 1000) {
      const page = check(
        await sb.from('attendance').select('employee_id,att_date,status').gte('att_date', from).lte('att_date', to)
          .order('att_date').range(off, off + 999),
      ) as AttendanceRow[]
      rows.push(...page)
      if (page.length < 1000) return rows
    }
  },
  async upsertMarks(rows) {
    if (!rows.length) return
    check(await sb.from('attendance').upsert(rows, { onConflict: 'employee_id,att_date' }))
  },
  async deleteMarks(rows) {
    if (!rows.length) return
    // ids are uuids and dates are YYYY-MM-DD, so they are safe inside the filter text
    const filter = rows.map((r) => `and(employee_id.eq.${r.employee_id},att_date.eq.${r.att_date})`).join(',')
    check(await sb.from('attendance').delete().or(filter))
  },
  async exportAll() {
    const [employee, period] = await Promise.all([this.getEmployees(), this.getPeriods()])
    const attendance = await this.getAttendance('1900-01-01', '9999-12-31')
    return { employee, period, attendance }
  },
})

// The check is on build-time settings, so a real build drops demo mode (and its staff list) entirely.
export const db: Db = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  ? supabaseDb(supabase!)
  : demoDb()

// ---- Roster rules ----

/** Employees with left_on null or on/after the period start, in display_order, serials from 1. */
export function buildRoster(employees: Employee[], start: string): RosterEntry[] {
  return employees
    .filter((e) => !e.left_on || e.left_on >= start)
    .sort((a, b) => a.display_order - b.display_order)
    .map((e, i) => ({
      employee_id: e.id, serial: i + 1, full_name: e.full_name, designation: e.designation,
      pf_hrms_number: e.pf_hrms_number, code: e.code,
    }))
}

/** Frozen roster if the period row exists; otherwise derived from staff (browsing never creates a row). */
export function rosterFor(start: string, periods: PeriodRow[], employees: Employee[]): RosterEntry[] {
  return periods.find((p) => p.start_date === start)?.roster ?? buildRoster(employees, start)
}

const known = new Set<string>()
export function markPeriodsKnown(starts: string[]) { starts.forEach((s) => known.add(s)) }
/** Create the period row just before the first attendance write in it. */
export async function ensurePeriodFor(date: string): Promise<void> {
  const { start, end } = periodFor(date)
  if (known.has(start)) return
  await db.ensurePeriod({ start_date: start, end_date: end, roster: buildRoster(await db.getEmployees(), start) })
  known.add(start)
}

/** After Staff changes: rewrite the roster of the period containing today, if it exists. */
export async function refreshCurrentRoster(today: string): Promise<void> {
  const { start } = periodFor(today)
  const periods = await db.getPeriods()
  if (!periods.some((p) => p.start_date === start)) return
  await db.updatePeriod(start, { roster: buildRoster(await db.getEmployees(), start) })
}
