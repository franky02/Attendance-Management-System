// Demo mode, used only when the app is built without Supabase settings.
// It is the only place the app code reads the staff list, so real builds never contain it.
import type { Db } from './db'
import { SEED_STAFF } from './seed'
import type { AttendanceRow, Employee, NightDutyRow, PeriodRow } from './types'

// Demo mode: used when no Supabase settings are present. Data stays in this browser only.
const LS = 'ennore-muster-demo'
interface DemoState { employee: Employee[]; period: PeriodRow[]; attendance: AttendanceRow[]; night_duty: NightDutyRow[] }

function demoLoad(): DemoState {
  try {
    const s = localStorage.getItem(LS)
    if (s) return { night_duty: [], ...JSON.parse(s) }
  } catch { /* ignore */ }
  return {
    employee: SEED_STAFF.map(([full_name, designation, pf_hrms_number, code], i) => ({
      id: crypto.randomUUID(), full_name, designation, pf_hrms_number, code, display_order: i + 1, left_on: null,
    })),
    period: [],
    attendance: [],
    night_duty: [],
  }
}

export const demoDb = (): Db => {
  const st = demoLoad()
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)) } catch { /* ignore */ } }
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
  const delay = () => new Promise((r) => setTimeout(r, 120))
  return {
    demo: true,
    async getEmployees() { return clone([...st.employee].sort((a, b) => a.display_order - b.display_order)) },
    async saveEmployee(e) {
      await delay()
      const row = { ...e, id: e.id ?? crypto.randomUUID() } as Employee
      const i = st.employee.findIndex((x) => x.id === row.id)
      if (i >= 0) st.employee[i] = row
      else st.employee.push(row)
      save()
      return clone(row)
    },
    async getPeriods() { return clone([...st.period].sort((a, b) => b.start_date.localeCompare(a.start_date))) },
    async ensurePeriod(row) {
      if (!st.period.some((p) => p.start_date === row.start_date)) {
        st.period.push({ ...row, remarks: '', final_downloaded_at: null })
        save()
      }
    },
    async updatePeriod(start, patch) {
      const p = st.period.find((x) => x.start_date === start)
      if (p) Object.assign(p, patch)
      save()
    },
    async getAttendance(from, to) { return clone(st.attendance.filter((a) => a.att_date >= from && a.att_date <= to)) },
    async upsertMarks(rows) {
      await delay()
      const k = (r: { employee_id: string; att_date: string }) => r.employee_id + '|' + r.att_date
      const incoming = new Set(rows.map(k))
      st.attendance = st.attendance.filter((a) => !incoming.has(k(a))).concat(rows.map(({ employee_id, att_date, status }) => ({ employee_id, att_date, status })))
      save()
    },
    async deleteMarks(rows) {
      await delay()
      const gone = new Set(rows.map((r) => r.employee_id + '|' + r.att_date))
      st.attendance = st.attendance.filter((a) => !gone.has(a.employee_id + '|' + a.att_date))
      save()
    },
    async getNightDuty(periodStart) { return clone(st.night_duty.filter((r) => r.period_start === periodStart)) },
    async upsertNightDuty(rows) {
      await delay()
      const k = (r: NightDutyRow) => r.period_start + '|' + r.employee_id
      const incoming = new Set(rows.map(k))
      st.night_duty = st.night_duty.filter((r) => !incoming.has(k(r))).concat(clone(rows))
      save()
    },
    async exportAll() { return clone(st) },
  }
}
