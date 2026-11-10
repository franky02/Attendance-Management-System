import { useEffect, useRef, useState } from 'react'
import { db, ensurePeriodFor } from './db'
import { friendlyDate, periodColumns, periodFor, periodLabel } from './dates'
import { countUnmarked, downloadFinal, downloadInterim, preloadPdf } from './data'
import { usePeriodData } from './store'
import { saveMark } from './saver'
import { CodePicker } from './CodePicker'
import { STATUS_CODES, statusColor, statusOf } from './statusCodes'
import { key } from './types'


export function MusterScreen({ today }: { today: string }) {
  const current = periodFor(today).start
  const [start, setStart] = useState(current)
  const data = usePeriodData(start)
  const { roster, marks, row } = data
  const ended = periodFor(start).end < today
  const [editing, setEditing] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [asOf, setAsOf] = useState(today)
  const [working, setWorking] = useState(false)
  const [picker, setPicker] = useState<{ employeeId: string; name: string; date: string } | null>(null)

  useEffect(() => { setEditing(false); setAsOf(today) }, [start, today])
  useEffect(() => { preloadPdf() }, [])

  // Show today's column (or the start of an ended period) without sideways scrolling.
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const w = wrapRef.current
    if (!w || data.loading) return
    const th = w.querySelector<HTMLElement>(`th[data-date="${today}"]`)
    const frozen = (w.querySelector<HTMLElement>('th.c-name')?.offsetWidth ?? 0) + (w.querySelector<HTMLElement>('th.c-sl')?.offsetWidth ?? 0)
    w.scrollLeft = th ? th.offsetLeft - frozen - (w.clientWidth - frozen) / 2 + th.offsetWidth / 2 : 0
  }, [start, today, data.loading])
  useEffect(() => { setRemarks(row?.remarks ?? '') }, [row?.remarks, start])

  const options = Array.from(new Set([current, ...data.periods.map((p) => p.start_date)]))
    .filter((s) => s <= current)
    .sort()
    .reverse()
  const cols = periodColumns(start)
  const locked = ended && !editing
  const unmarked = countUnmarked(start, roster, marks)

  // With many leave types, a tap opens the list of codes rather than cycling through them.
  const tapCell = (employeeId: string, name: string, date: string) => {
    if (locked || date > today) return
    setPicker({ employeeId, name, date })
  }
  const pick = (code: string | null) => {
    if (!picker) return
    data.setMarkLocal(picker.employeeId, picker.date, code)
    saveMark(picker.employeeId, picker.date, code)
  }

  const saveRemarks = async () => {
    if (remarks === (row?.remarks ?? '')) return
    try {
      await ensurePeriodFor(start)
      await db.updatePeriod(start, { remarks })
      await data.reload()
    } catch {
      alert('Could not save remarks. Check the internet connection.')
    }
  }

  const run = async (fn: () => Promise<unknown>) => {
    setWorking(true)
    try { await fn() } catch (e) { alert('Could not make the PDF: ' + (e instanceof Error ? e.message : e)) }
    finally { setWorking(false) }
  }

  return (
    <div className="screen">
      <label className="field">
        <span>Period</span>
        <select value={start} onChange={(e) => setStart(e.target.value)}>
          {options.map((s) => (
            <option key={s} value={s}>{periodLabel(s)}{s === current ? ' (current)' : ''}</option>
          ))}
        </select>
      </label>

      <div className="legend">
        {['P', 'R', 'A'].map((c) => <span key={c}><b style={{ color: statusColor(c) }}>{c}</b> {statusOf(c)!.label.replace(' (no leave type)', '')}</span>)}
        <span><b style={{ color: statusColor('CL') }}>CL…</b> Leave type</span>
        <span>Tap a box to change it</span>
      </div>

      {ended && (
        <div className="ended-bar">
          {locked
            ? <><span>This period has ended. It is read-only.</span><button className="small-btn" onClick={() => setEditing(true)}>Edit this period</button></>
            : <><span>Editing an ended period.</span><button className="small-btn" onClick={() => setEditing(false)}>Done</button></>}
        </div>
      )}

      {data.error && <div className="error-box">Could not load: {data.error} <button onClick={data.reload}>Retry</button></div>}

      <div className="grid-wrap" ref={wrapRef}>
        <table className="grid">
          <thead>
            <tr>
              <th className="sticky c-sl">Sl.</th>
              <th className="sticky c-name">Name</th>
              <th>Des.</th>
              <th>PF / HRMS</th>
              {cols.map((c, i) => (
                <th key={i} data-date={c.date ?? undefined} className={'day' + (i === 16 ? ' divider' : '') + (c.date === today ? ' today' : '')}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.employee_id}>
                <td className="sticky c-sl">{r.serial}.</td>
                <td className="sticky c-name">{r.full_name}</td>
                <td>{r.designation}</td>
                <td className="pf">{r.pf_hrms_number}<br /><small>{r.code}</small></td>
                {cols.map((c, i) => {
                  const cls = 'cell' + (i === 16 ? ' divider' : '')
                  if (!c.date) return <td key={i} className={cls + ' nodate'} />
                  const s = marks[key(r.employee_id, c.date)]
                  const future = c.date > today
                  return (
                    <td
                      key={i}
                      className={cls + (future ? ' future' : '') + (locked ? ' locked' : '') + (s && s.length > 1 ? ` len${Math.min(s.length, 4)}` : '')}
                      style={s ? { color: statusColor(s) } : undefined}
                      title={s ? statusOf(s)?.label : undefined}
                      onClick={() => tapCell(r.employee_id, r.full_name, c.date!)}
                    >{s ?? ''}</td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">{unmarked} entries unmarked in this period.</p>

      {picker && (
        <CodePicker
          title={picker.name}
          subtitle={friendlyDate(picker.date)}
          options={STATUS_CODES}
          current={data.markNow(picker.employeeId, picker.date)}
          onPick={pick}
          onClose={() => setPicker(null)}
        />
      )}

      <label className="field">
        <span>Remarks (printed on the muster)</span>
        <textarea rows={2} value={remarks} disabled={locked} onChange={(e) => setRemarks(e.target.value)} onBlur={saveRemarks} />
      </label>

      {!ended ? (
        <div className="pdf-box">
          <label className="field">
            <span>Interim PDF, recorded up to</span>
            <input type="date" min={start} max={today} value={asOf} onChange={(e) => setAsOf(e.target.value || today)} />
          </label>
          <button className="big-btn" disabled={working} onClick={() => run(() => downloadInterim(start, roster, marks, remarks, asOf))}>
            {working ? 'Making PDF…' : 'Download interim PDF'}
          </button>
        </div>
      ) : (
        <div className="pdf-box">
          {row?.final_downloaded_at && <p className="muted">Final PDF downloaded on {new Date(row.final_downloaded_at).toLocaleDateString('en-IN')}.</p>}
          <button className="big-btn" disabled={working} onClick={() => run(async () => { await saveRemarks(); if (await downloadFinal(start)) await data.reload() })}>
            {working ? 'Making PDF…' : 'Download final PDF'}
          </button>
        </div>
      )}
    </div>
  )
}
