import { useEffect, useRef, useState } from 'react'
import { addDays, friendlyDate, periodFor, periodLabel, shiftPeriod } from './dates'
import { countUnmarked, downloadFinal, preloadPdf } from './data'
import { saveMark } from './saver'
import { CodePicker } from './CodePicker'
import { useHolidays } from './holidays'
import { ABSENT_CODES, kindOf, statusColor, statusOf, type Kind } from './statusCodes'
import { loadPeriod, refreshMeta, useStore, usePeriodData } from './store'
import { key, type PeriodRow } from './types'

export function MarkScreen({ today }: { today: string }) {
  const holidays = useHolidays()
  const [date, setDate] = useState(today)
  const { start } = periodFor(date)
  const data = usePeriodData(start)
  const { roster, marks, setMarkLocal, markNow } = data
  const [undo, setUndo] = useState<{ date: string; ids: string[] } | null>(null)
  const [picker, setPicker] = useState<{ employeeId: string; name: string } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Have the previous period ready before the arrows reach it.
  useEffect(() => {
    const t = setTimeout(() => { void loadPeriod(shiftPeriod(start, -1)).catch(() => {}) }, 1500)
    return () => clearTimeout(t)
  }, [start])

  const set = (employeeId: string, d: string, status: string | null) => {
    setMarkLocal(employeeId, d, status)
    saveMark(employeeId, d, status)
  }

  const tap = (employeeId: string, code: string) => set(employeeId, date, markNow(employeeId, date) === code ? null : code)

  // Fills blanks only. Shows instantly; saving happens in the background.
  const markRemaining = () => {
    const ids = roster.map((r) => r.employee_id).filter((id) => !markNow(id, date))
    if (!ids.length) return
    ids.forEach((id) => set(id, date, 'P'))
    clearTimeout(undoTimer.current)
    setUndo({ date, ids })
    undoTimer.current = setTimeout(() => setUndo(null), 10000)
  }

  // Removes only the cells that action filled, and only if they are still P.
  const doUndo = () => {
    if (!undo) return
    undo.ids.forEach((id) => { if (markNow(id, undo.date) === 'P') set(id, undo.date, null) })
    clearTimeout(undoTimer.current)
    setUndo(null)
  }

  const COUNT_LABELS: [Kind, string, string][] = [['present', 'Present', statusOf('P')!.color], ['absent', 'Absent', statusOf('A')!.color], ['rest', 'Rest', statusOf('R')!.color]]
  const counts = COUNT_LABELS.map(([kind, label, color]) => ({
    code: kind, label, color,
    n: roster.filter((r) => { const m = marks[key(r.employee_id, date)]; return m && kindOf(m) === kind }).length,
  }))
  const unmarked = roster.filter((r) => !marks[key(r.employee_id, date)]).length
  const showUndo = undo && undo.date === date

  return (
    <div className="screen">
      <ReadyBanner periods={data.periods} today={today} />

      <div className="date-nav">
        <button className="arrow" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <div className="date-mid">
          <div className="eyebrow">Period {periodLabel(start)}</div>
          <div className="date-big">{friendlyDate(date)}{date === today && <span className="today-tag">Today</span>}</div>
          {holidays.byDate.has(date) && <div className="nh-tag">National Holiday{holidays.byDate.get(date) ? ` · ${holidays.byDate.get(date)}` : ''}</div>}
        </div>
        <button className="arrow" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>›</button>
      </div>
      {date !== today && <button className="link-btn" onClick={() => setDate(today)}>Back to today</button>}

      <div className="counts">
        {counts.map((c) => (
          <div key={c.code} className="count" style={{ '--c': c.color } as React.CSSProperties}><span>{c.label}</span><b>{c.n}</b></div>
        ))}
        <div className="count"><span>To mark</span><b>{unmarked}</b></div>
      </div>

      {data.error && <div className="error-box">Could not load: {data.error} <button onClick={data.reload}>Retry</button></div>}
      {data.loading && !roster.length && <p className="muted center-text">Loading…</p>}

      <div className="mark-list">
        {roster.map((r) => {
          const cur = marks[key(r.employee_id, date)]
          return (
            <div key={r.employee_id} className={'mark-row' + (cur ? '' : ' blank')}>
              <span className="dot" style={cur ? { '--c': statusColor(cur) } as React.CSSProperties : undefined} aria-hidden="true" />
              <div className="who">
                <div className="name">{r.serial}. {r.full_name}</div>
                <div className="muted">{r.designation}</div>
              </div>
              <div className="codes">
                <button
                  className={'code-btn' + (cur === 'P' ? ' on' : '')}
                  style={{ '--c': statusOf('P')!.color } as React.CSSProperties}
                  aria-pressed={cur === 'P'}
                  aria-label={`Present for ${r.full_name}`}
                  onClick={() => tap(r.employee_id, 'P')}
                >P</button>
                {(() => {
                  const leave = cur && kindOf(cur) === 'absent' ? cur : null
                  return (
                    <button
                      className={'code-btn' + (leave ? ' on' : '') + (leave && leave.length > 2 ? ' small' : '')}
                      style={{ '--c': statusOf('A')!.color } as React.CSSProperties}
                      aria-pressed={!!leave}
                      aria-haspopup="dialog"
                      aria-label={`Leave or absent for ${r.full_name}${leave ? `, now ${statusOf(leave)?.label ?? leave}` : ''}`}
                      onClick={() => setPicker({ employeeId: r.employee_id, name: r.full_name })}
                    >{leave ?? 'A'}</button>
                  )
                })()}
                <button
                  className={'code-btn' + (cur === 'R' ? ' on' : '')}
                  style={{ '--c': statusOf('R')!.color } as React.CSSProperties}
                  aria-pressed={cur === 'R'}
                  aria-label={`Rest for ${r.full_name}`}
                  onClick={() => tap(r.employee_id, 'R')}
                >R</button>
              </div>
            </div>
          )
        })}
      </div>

      {picker && (
        <CodePicker
          title={picker.name}
          subtitle={`Leave or absent · ${friendlyDate(date)}`}
          options={ABSENT_CODES}
          current={markNow(picker.employeeId, date)}
          onPick={(code) => set(picker.employeeId, date, code)}
          onClose={() => setPicker(null)}
        />
      )}

      <div className="bottom-actions">
        {showUndo ? (
          <button className="big-btn secondary" onClick={doUndo}>Undo ({undo.ids.length} marked Present)</button>
        ) : (
          <button className="big-btn" disabled={unmarked === 0 || !roster.length} onClick={markRemaining}>
            Mark remaining Present ({unmarked})
          </button>
        )}
      </div>
    </div>
  )
}

function ReadyBanner({ periods, today }: { periods: PeriodRow[]; today: string }) {
  const p = periods.find((x) => x.end_date < today && !x.final_downloaded_at)
  const { marks, loaded } = useStore()
  const [working, setWorking] = useState(false)
  useEffect(() => {
    if (!p) return
    void loadPeriod(p.start_date).catch(() => {})
    preloadPdf()
  }, [p?.start_date])
  if (!p) return null
  const unmarked = loaded[p.start_date] ? countUnmarked(p.start_date, p.roster, marks) : null
  return (
    <div className="banner">
      <span>Muster for {periodLabel(p.start_date)} is ready.{unmarked !== null && ` ${unmarked} entries unmarked.`}</span>
      <button className="banner-btn" disabled={working} onClick={async () => {
        setWorking(true)
        try { if (await downloadFinal(p.start_date)) await refreshMeta() }
        catch (e) { alert('Could not make the PDF: ' + (e instanceof Error ? e.message : e)) }
        finally { setWorking(false) }
      }}>{working ? 'Making PDF…' : 'Download'}</button>
    </div>
  )
}
