import { useEffect, useState } from 'react'
import { absenteeRows, dayMonth, isFullPeriod, maxAsOf } from './absentees'
import { friendlyDate, periodFor, periodLabel, shortDate } from './dates'
import { downloadAbsentees, preloadPdf } from './data'
import { usePeriodData } from './store'

export function AbsenteesScreen({ today }: { today: string }) {
  const current = periodFor(today).start
  const [start, setStart] = useState(current)
  const data = usePeriodData(start)
  const latest = maxAsOf(start, today)
  const [asOf, setAsOf] = useState(latest)
  const [working, setWorking] = useState(false)

  useEffect(() => { setAsOf(maxAsOf(start, today)) }, [start, today])
  useEffect(() => { preloadPdf('absentees') }, [])

  const options = Array.from(new Set([current, ...data.periods.map((p) => p.start_date)]))
    .filter((s) => s <= current)
    .sort()
    .reverse()
  const upTo = asOf < start ? start : asOf > latest ? latest : asOf
  const rows = absenteeRows(start, upTo, data.roster, data.marks)
  const total = rows.reduce((t, r) => ({ lap: t.lap + r.lap, sick: t.sick + r.sick, cr: t.cr + r.crDates.length }), { lap: 0, sick: 0, cr: 0 })

  const download = async () => {
    setWorking(true)
    try { await downloadAbsentees(start, upTo, data.roster, data.marks) }
    catch (e) { alert('Could not make the PDF: ' + (e instanceof Error ? e.message : e)) }
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
      <label className="field">
        <span>Count up to</span>
        <input type="date" min={start} max={latest} value={upTo} onChange={(e) => setAsOf(e.target.value || latest)} />
      </label>
      <p className="muted">
        LAP, Sick (S) and Compensatory Rest (CR) from {shortDate(start)} to {friendlyDate(upTo)}
        {isFullPeriod(start, upTo) ? ', the whole period.' : '.'}
      </p>

      {data.error && <div className="error-box">Could not load: {data.error} <button onClick={data.reload}>Retry</button></div>}

      <div className="abs-wrap">
        <table className="abs-table">
          <thead>
            <tr><th className="l">Name</th><th>LAP</th><th>SICK</th><th className="l">CR dates</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.entry.employee_id} className={r.lap || r.sick || r.crDates.length ? 'has' : ''}>
                <td className="l"><span className="sl">{r.entry.serial}.</span> {r.entry.full_name}</td>
                <td>{r.lap || ''}</td>
                <td>{r.sick || ''}</td>
                <td className="l cr">{r.crDates.map(dayMonth).join(', ')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td className="l">Total</td><td>{total.lap}</td><td>{total.sick}</td><td className="l">{total.cr} day{total.cr === 1 ? '' : 's'}</td></tr>
          </tfoot>
        </table>
      </div>

      <button className="big-btn" disabled={working || !data.roster.length} onClick={download}>
        {working ? 'Making PDF…' : 'Download absentees statement'}
      </button>
    </div>
  )
}
