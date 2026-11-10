// Saves taps in the background. Taps made in quick succession go in one request.
// Unsaved taps are kept on the phone, so closing the app does not lose them.
import { useSyncExternalStore } from 'react'
import { db, ensurePeriodFor, storageScope } from './db'
import { periodFor } from './dates'
import { key } from './types'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface Pending { employeeId: string; date: string; status: string | null }

const QUEUE_KEY = `ennore-muster-unsaved-v1:${storageScope}`
const queue = new Map<string, Pending>() // latest wish per cell
try {
  for (const p of JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Pending[]) queue.set(key(p.employeeId, p.date), p)
} catch { /* ignore */ }

let state: SaveState = 'idle'
let running = false
const listeners = new Set<() => void>()
let snapshot: { state: SaveState; failed: number } = { state, failed: 0 }

function emit() {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue.values()])) } catch { /* ignore */ }
  snapshot = { state, failed: state === 'error' ? queue.size : 0 }
  listeners.forEach((l) => l())
}

async function run() {
  if (running) return
  running = true
  state = 'saving'
  emit()
  try {
    // Let a burst of taps collect, then send them together.
    await new Promise((r) => setTimeout(r, 150))
    while (queue.size) {
      const batch = [...queue.entries()]
      const starts = new Map<string, string>()
      for (const [, p] of batch) starts.set(periodFor(p.date).start, p.date)
      for (const d of starts.values()) await ensurePeriodFor(d)
      const ups = batch.filter(([, p]) => p.status).map(([, p]) => ({
        employee_id: p.employeeId, att_date: p.date, status: p.status!, updated_at: new Date().toISOString(),
      }))
      const dels = batch.filter(([, p]) => !p.status).map(([, p]) => ({ employee_id: p.employeeId, att_date: p.date }))
      await Promise.all([db.upsertMarks(ups), db.deleteMarks(dels)])
      // Only drop entries that no newer tap replaced while saving.
      for (const [k, p] of batch) if (queue.get(k) === p) queue.delete(k)
      emit()
    }
    state = 'saved'
  } catch {
    state = 'error'
  } finally {
    running = false
    emit()
  }
}

export function saveMark(employeeId: string, date: string, status: string | null) {
  queue.set(key(employeeId, date), { employeeId, date, status })
  void run()
}

export function pendingEntries(): Pending[] {
  return [...queue.values()]
}

if (queue.size) setTimeout(() => void run(), 0)
setInterval(() => { if (state === 'error' && queue.size) void run() }, 5000)
window.addEventListener('online', () => { if (queue.size) void run() })

export function useSaveState() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => snapshot,
  )
}
