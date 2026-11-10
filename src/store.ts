// One shared copy of the data, kept on the phone. Screens render from it instantly
// and it refreshes from the server in the background.
import { useEffect, useSyncExternalStore } from 'react'
import { db, markPeriodsKnown, rosterFor, storageScope } from './db'
import { addDays, periodFor, todayIST } from './dates'
import { pendingEntries } from './saver'
import { key, type Employee, type Marks, type PeriodRow, type RosterEntry } from './types'

interface State {
  employees: Employee[]
  periods: PeriodRow[]
  marks: Marks // all loaded periods, keyed `${employee_id}|${date}`
  loaded: Record<string, true> // period starts we have data for
  error: string | null
}

const CACHE_KEY = `ennore-muster-cache-v1:${storageScope}`
const KEEP_DAYS = 200 // marks older than this are not kept on the phone

function hydrate(): State {
  try {
    const s = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    if (s && Array.isArray(s.employees)) return { ...s, error: null }
  } catch { /* ignore */ }
  return { employees: [], periods: [], marks: {}, loaded: {}, error: null }
}

let state = hydrate()
markPeriodsKnown(state.periods.map((p) => p.start_date))
const listeners = new Set<() => void>()
let persistTimer: ReturnType<typeof setTimeout> | undefined

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
  clearTimeout(persistTimer)
  persistTimer = setTimeout(persist, 400)
}

function persist() {
  const cutoff = addDays(todayIST(), -KEEP_DAYS)
  const marks: Marks = {}
  for (const [k, v] of Object.entries(state.marks)) if (k.slice(-10) >= cutoff) marks[k] = v
  const loaded: Record<string, true> = {}
  for (const s of Object.keys(state.loaded)) if (periodFor(s).end >= cutoff) loaded[s] = true
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ employees: state.employees, periods: state.periods, marks, loaded }))
  } catch { /* storage full or blocked: the app still works from memory */ }
}

export function getState() { return state }

export async function refreshMeta() {
  const [employees, periods] = await Promise.all([db.getEmployees(), db.getPeriods()])
  markPeriodsKnown(periods.map((p) => p.start_date))
  set({ employees, periods })
}

const inflight = new Map<string, Promise<void>>()
export function loadPeriod(start: string): Promise<void> {
  const existing = inflight.get(start)
  if (existing) return existing
  const p = (async () => {
    const { end } = periodFor(start)
    const rows = await db.getAttendance(start, end)
    const marks: Marks = {}
    for (const [k, v] of Object.entries(state.marks)) {
      const d = k.slice(-10)
      if (d < start || d > end) marks[k] = v
    }
    for (const r of rows) marks[key(r.employee_id, r.att_date)] = r.status
    // Taps still waiting to save win over what the server has.
    for (const q of pendingEntries()) {
      if (q.date < start || q.date > end) continue
      if (q.status) marks[key(q.employeeId, q.date)] = q.status
      else delete marks[key(q.employeeId, q.date)]
    }
    set({ marks, loaded: { ...state.loaded, [start]: true } })
  })().finally(() => inflight.delete(start))
  inflight.set(start, p)
  return p
}

export function setMarkLocal(employeeId: string, date: string, status: string | null) {
  const marks = { ...state.marks }
  if (status) marks[key(employeeId, date)] = status
  else delete marks[key(employeeId, date)]
  set({ marks })
}

export function markNow(employeeId: string, date: string): string | undefined {
  return state.marks[key(employeeId, date)]
}

// Periods on screen right now, refreshed when the app comes back to the front.
const active = new Map<string, number>()

async function refresh(start: string) {
  try {
    await Promise.all([refreshMeta(), loadPeriod(start)])
    if (state.error) set({ error: null })
  } catch (e) {
    set({ error: e instanceof Error ? e.message : String(e) })
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') for (const s of active.keys()) void refresh(s)
  })
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
export function useStore(): State {
  return useSyncExternalStore(subscribe, getState)
}

export interface PeriodData {
  loading: boolean
  error: string | null
  employees: Employee[]
  periods: PeriodRow[]
  roster: RosterEntry[]
  marks: Marks
  row: PeriodRow | undefined
  setMarkLocal: typeof setMarkLocal
  markNow: typeof markNow
  reload: () => Promise<void>
}

export function usePeriodData(start: string): PeriodData {
  const s = useStore()
  useEffect(() => {
    active.set(start, (active.get(start) ?? 0) + 1)
    void refresh(start)
    return () => {
      const n = (active.get(start) ?? 1) - 1
      if (n) active.set(start, n)
      else active.delete(start)
    }
  }, [start])
  return {
    loading: !s.loaded[start] || !s.employees.length,
    error: s.error,
    employees: s.employees,
    periods: s.periods,
    roster: rosterFor(start, s.periods, s.employees),
    marks: s.marks,
    row: s.periods.find((p) => p.start_date === start),
    setMarkLocal,
    markNow,
    reload: () => refresh(start),
  }
}
