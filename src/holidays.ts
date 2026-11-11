// National holidays: one shared list, kept on the phone and refreshed in the background.
// Used by the NH tab, and to mark NH days on the Mark screen and the Muster grid.
import { useEffect, useSyncExternalStore } from 'react'
import { db, storageScope } from './db'
import type { Holiday } from './types'

const KEY = `ennore-muster-holidays-v1:${storageScope}`
let list: Holiday[] = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } })()
let byDate = new Map(list.map((h) => [h.holiday_date, h.name]))
const listeners = new Set<() => void>()
let snapshot = { list, byDate }

function set(next: Holiday[]) {
  list = [...next].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
  byDate = new Map(list.map((h) => [h.holiday_date, h.name]))
  snapshot = { list, byDate }
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

let inflight: Promise<void> | null = null
export function refreshHolidays(): Promise<void> {
  return (inflight ??= db.getHolidays().then(set).finally(() => { inflight = null }))
}

export async function addHoliday(h: Holiday) {
  const before = list
  set([...list.filter((x) => x.holiday_date !== h.holiday_date), h])
  try { await db.saveHoliday(h) } catch (e) { set(before); throw e }
}

export async function removeHoliday(date: string) {
  const before = list
  set(list.filter((x) => x.holiday_date !== date))
  try { await db.deleteHoliday(date) } catch (e) { set(before); throw e }
}

export function useHolidays() {
  const s = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => snapshot)
  useEffect(() => { void refreshHolidays().catch(() => {}) }, [])
  return s
}
