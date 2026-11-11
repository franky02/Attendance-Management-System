import { useCallback, useEffect, useRef, useState } from 'react'
import { db, storageScope } from './db'
import { periodFor, periodLabel } from './dates'
import { downloadNda, preloadPdf } from './data'
import { DEFAULT_ROSTER, fmtNumber, fmtWeighted, parseHours, weighted } from './nightDuty'
import { usePeriodData } from './store'
import type { NightDutyRow } from './types'

interface Draft { roster: string; hours: string; remarks: string }
type Status = 'idle' | 'saving' | 'saved' | 'error'

const cacheKey = (start: string) => `ennore-muster-nda-v1:${storageScope}:${start}`
const blank = (): Draft => ({ roster: DEFAULT_ROSTER, hours: '', remarks: '' })
const toDraft = (r: NightDutyRow): Draft => ({ roster: r.roster || DEFAULT_ROSTER, hours: r.hours == null ? '' : fmtNumber(Number(r.hours)), remarks: r.remarks ?? '' })

function readCache(start: string): { drafts: Record<string, Draft>; dirty: string[] } {
  try { return JSON.parse(localStorage.getItem(cacheKey(start)) ?? '') } catch { return { drafts: {}, dirty: [] } }
}

export function NightDutyScreen({ today }: { today: string }) {
  const current = periodFor(today).start
  const [start, setStart] = useState(current)
  const data = usePeriodData(start)
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => readCache(current).drafts)
  const [status, setStatus] = useState<Status>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  // Latest values for the background saver, which runs outside React's render cycle.
  const draftsRef = useRef(drafts)
  const dirty = useRef(new Set<string>(readCache(current).dirty))
  const startRef = useRef(start)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const saving = useRef(false)

  const persistCache = useCallback(() => {
    try { localStorage.setItem(cacheKey(startRef.current), JSON.stringify({ drafts: draftsRef.current, dirty: [...dirty.current] })) } catch { /* ignore */ }
  }, [])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (saving.current || !dirty.current.size) return
    const periodStart = startRef.current
    const ids = [...dirty.current].filter((id) => parseHours(draftsRef.current[id]?.hours ?? '') !== undefined)
    if (!ids.length) return
    const rows: NightDutyRow[] = ids.map((id) => {
      const d = draftsRef.current[id]
      return { period_start: periodStart, employee_id: id, roster: d.roster.trim() || DEFAULT_ROSTER, hours: parseHours(d.hours) ?? null, remarks: d.remarks.trim() }
    })
    const sent = new Map(ids.map((id) => [id, JSON.stringify(draftsRef.current[id])]))
    saving.current = true
    setStatus('saving')
    try {
      await db.upsertNightDuty(rows)
      // Keep a row marked unsaved if it was edited again while this save was in flight.
      if (startRef.current === periodStart) {
        for (const id of ids) if (JSON.stringify(draftsRef.current[id]) === sent.get(id)) dirty.current.delete(id)
        persistCache()
      }
      setStatus('saved')
    } catch {
      setStatus('error')
      timer.current = setTimeout(() => void flush(), 5000)
    } finally {
      saving.current = false
      if (dirty.current.size && startRef.current === periodStart) timer.current = setTimeout(() => void flush(), 700)
    }
  }, [persistCache])

  // Load the period: show the phone's copy at once, then the server's (keeping unsaved edits).
  useEffect(() => {
    void flush()
    startRef.current = start
    const cached = readCache(start)
    dirty.current = new Set(cached.dirty)
    draftsRef.current = cached.drafts
    setDrafts(cached.drafts)
    setStatus('idle')
    let live = true
    db.getNightDuty(start).then((rows) => {
      if (!live) return
      const next: Record<string, Draft> = {}
      for (const r of rows) next[r.employee_id] = toDraft(r)
      for (const id of dirty.current) if (draftsRef.current[id]) next[id] = draftsRef.current[id]
      draftsRef.current = next
      setDrafts(next)
      persistCache()
      setLoadError(null)
      if (dirty.current.size) void flush()
    }).catch((e) => { if (live) setLoadError(e instanceof Error ? e.message : String(e)) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start])

  useEffect(() => { preloadPdf('nda') }, [])
  useEffect(() => () => { void flush() }, [flush])

  const edit = (id: string, field: keyof Draft, value: string) => {
    const next = { ...draftsRef.current, [id]: { ...(draftsRef.current[id] ?? blank()), [field]: value } }
    draftsRef.current = next
    setDrafts(next)
    dirty.current.add(id)
    persistCache()
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 800)
  }

  const options = Array.from(new Set([current, ...data.periods.map((p) => p.start_date)]))
    .filter((s) => s <= current).sort().reverse()

  const entries: NightDutyRow[] = data.roster.map((r) => {
    const d = drafts[r.employee_id] ?? blank()
    const h = parseHours(d.hours)
    return { period_start: start, employee_id: r.employee_id, roster: d.roster.trim() || DEFAULT_ROSTER, hours: h ?? null, remarks: d.remarks.trim() }
  })
  const totalHours = entries.reduce((t, e) => t + (e.hours ?? 0), 0)
  const totalWeighted = entries.reduce((t, e) => t + (weighted(e.hours) ?? 0), 0)
  const invalid = data.roster.filter((r) => parseHours(drafts[r.employee_id]?.hours ?? '') === undefined).length

  const download = async () => {
    setWorking(true)
    try { void flush(); await downloadNda(start, data.roster, entries) }
    catch (e) { alert('Could not make the PDF: ' + (e instanceof Error ? e.message : e)) }
    finally { setWorking(false) }
  }

  return (
    <div className="screen">
      <label className="field">
        <span>Period</span>
        <select value={start} onChange={(e) => setStart(e.target.value)}>
          {options.map((s) => <option key={s} value={s}>{periodLabel(s)}{s === current ? ' (current)' : ''}</option>)}
        </select>
      </label>
      <p className="muted nd-note">
        Enter each person's night duty hours. Weighted Hrs. is the hours ÷ 6, worked out for you.{' '}
        <span className={'nd-status ' + status}>
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && '✓ Saved'}
          {status === 'error' && 'Not saved · retrying'}
        </span>
      </p>

      {(loadError || data.error) && <div className="error-box">Could not load: {loadError ?? data.error}</div>}

      <div className="nd-list">
        {data.roster.map((r) => {
          const d = drafts[r.employee_id] ?? blank()
          const bad = parseHours(d.hours) === undefined
          return (
            <div key={r.employee_id} className="nd-card">
              <div className="nd-head">
                <span className="name">{r.serial}. {r.full_name}</span>
                <span className="nd-des">{r.designation}</span>
              </div>
              <div className="nd-fields">
                <label className="nd-f roster">
                  <span>Roster</span>
                  <input value={d.roster} onChange={(e) => edit(r.employee_id, 'roster', e.target.value)} onBlur={() => void flush()} autoCapitalize="words" />
                </label>
                <label className={'nd-f hours' + (bad ? ' bad' : '')}>
                  <span>Total Hrs.</span>
                  <input inputMode="decimal" placeholder="0" value={d.hours} onChange={(e) => edit(r.employee_id, 'hours', e.target.value)} onBlur={() => void flush()} aria-invalid={bad} />
                </label>
                <div className="nd-f weighted">
                  <span>Weighted Hrs.</span>
                  <output>{bad ? '–' : fmtWeighted(parseHours(d.hours)) || '–'}</output>
                </div>
              </div>
              {bad && <div className="nd-err">Numbers only, e.g. 48 or 7.5</div>}
              <label className="nd-f remarks">
                <span>Remarks</span>
                <input value={d.remarks} onChange={(e) => edit(r.employee_id, 'remarks', e.target.value)} onBlur={() => void flush()} />
              </label>
            </div>
          )
        })}
      </div>

      <div className="nd-total">
        <span>Total</span>
        <span><b>{fmtNumber(totalHours)}</b> hrs</span>
        <span><b>{fmtNumber(totalWeighted)}</b> weighted</span>
      </div>
      {invalid > 0 && <p className="nd-err">{invalid} entr{invalid === 1 ? 'y needs' : 'ies need'} fixing before it can be saved.</p>}

      <button className="big-btn" disabled={working || !data.roster.length} onClick={download}>
        {working ? 'Making PDF…' : 'Download NDA statement'}
      </button>
    </div>
  )
}
