import { useEffect, useState } from 'react'
import { buildRoster } from './db'
import { daysInMonth, monthLabel, monthStart, parts, periodFor, shiftMonth, ymd } from './dates'
import { downloadNha, preloadPdf } from './data'
import { addHoliday, removeHoliday, useHolidays } from './holidays'
import { MonthStrip } from './MonthStrip'
import { nhaCount, nhaRows, nhRemark, type NhResult } from './nha'
import { loadPeriod, refreshMeta, useStore } from './store'

const MONTHS_BACK = 24
const MONTHS_AHEAD = 2 // so upcoming holidays can be set in advance
const WORD: Record<NhResult, string> = { eligible: 'Eligible', ineligible: 'Not eligible', unmarked: 'Not marked' }

export function NhScreen({ today }: { today: string }) {
  const thisMonth = monthStart(today)
  const [month, setMonth] = useState(() => shiftMonth(thisMonth, -1))
  const { employees, marks } = useStore()
  const { list } = useHolidays()
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [working, setWorking] = useState(false)

  const [y, m] = parts(month)
  const first = month
  const last = ymd(y, m, daysInMonth(y, m))
  const holidays = list.filter((h) => h.holiday_date >= first && h.holiday_date <= last)
  const dates = holidays.map((h) => h.holiday_date)
  const roster = buildRoster(employees, month)
  const rows = nhaRows(dates, roster, marks)
  const unmarked = rows.reduce((t, r) => t + r.results.filter((x) => x.result === 'unmarked').length, 0)

  useEffect(() => { preloadPdf('nha'); void refreshMeta().catch(() => {}) }, [])
  // Eligibility comes from the muster: load the muster period(s) that hold this month's NH dates.
  useEffect(() => {
    for (const s of new Set(dates.map((d) => periodFor(d).start))) void loadPeriod(s).catch(() => {})
  }, [dates.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setNewDate(''); setNewName('') }, [month])

  const add = async () => {
    if (!newDate) return
    setBusy(true)
    try { await addHoliday({ holiday_date: newDate, name: newName.trim() }); setNewDate(''); setNewName('') }
    catch (e) { alert('Could not save the holiday: ' + (e instanceof Error ? e.message : e)) }
    finally { setBusy(false) }
  }
  const remove = async (date: string, name: string) => {
    if (!confirm(`Remove ${shortDay(date)}${name ? ` (${name})` : ''} as a national holiday?`)) return
    try { await removeHoliday(date) } catch (e) { alert('Could not remove it: ' + (e instanceof Error ? e.message : e)) }
  }
  const download = async () => {
    if (unmarked && !confirm(`${unmarked} NH entr${unmarked === 1 ? 'y is' : 'ies are'} not marked in the muster and will print as "Not marked". Download anyway?`)) return
    setWorking(true)
    try { await downloadNha(month, holidays, roster, marks) }
    catch (e) { alert('Could not make the PDF: ' + (e instanceof Error ? e.message : e)) }
    finally { setWorking(false) }
  }

  const months = Array.from({ length: MONTHS_BACK + MONTHS_AHEAD + 1 }, (_, i) => shiftMonth(thisMonth, i - MONTHS_BACK))

  return (
    <div className="screen">
      <MonthStrip months={months} value={month} onChange={setMonth} />
      <h2 className="nd-month">{monthLabel(month)}</h2>

      <div className="nh-box">
        <div className="eyebrow">National holidays this month</div>
        {holidays.length === 0 && <p className="muted">None set yet. Add each NH date below.</p>}
        {holidays.map((h) => (
          <div key={h.holiday_date} className="nh-item">
            <span className="nh-date">{shortDay(h.holiday_date)}</span>
            <span className="nh-name">{h.name || 'National holiday'}</span>
            <button className="nh-x" aria-label={`Remove ${shortDay(h.holiday_date)}`} onClick={() => void remove(h.holiday_date, h.name)}>✕</button>
          </div>
        ))}
        <div className="nh-add">
          <label className="nd-f"><span>Date</span>
            <input type="date" min={first} max={last} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </label>
          <label className="nd-f"><span>Name (optional)</span>
            <input value={newName} placeholder="e.g. Republic Day" onChange={(e) => setNewName(e.target.value)} />
          </label>
        </div>
        <button className="big-btn secondary" disabled={!newDate || busy} onClick={() => void add()}>{busy ? 'Saving…' : '+ Add NH date'}</button>
      </div>

      {dates.length > 0 && (
        <>
          <p className="muted nd-note">
            From the muster: P, R and CR on an NH day are <b className="nh-e">Eligible</b>; NH availed, A and any leave are <b className="nh-n">Not eligible</b>.
          </p>
          <div className="abs-wrap">
            <table className="abs-table nh-table">
              <thead>
                <tr>
                  <th className="l">Name</th>
                  {holidays.map((h) => <th key={h.holiday_date}>{shortDay(h.holiday_date)}</th>)}
                  <th>NHA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.entry.employee_id}>
                    <td className="l"><span className="sl">{r.entry.serial}.</span> {r.entry.full_name}</td>
                    {r.results.map((x) => (
                      <td key={x.date} className={'nh-cell ' + x.result}>
                        {WORD[x.result]}
                        {x.result !== 'unmarked' && <small>{nhRemark(x.code)}</small>}
                      </td>
                    ))}
                    <td className="nh-count">{nhaCount(r.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unmarked > 0 && <p className="nd-err">{unmarked} NH entr{unmarked === 1 ? 'y is' : 'ies are'} not marked yet. Mark them in the muster first.</p>}
          <button className="big-btn" disabled={working || !roster.length} onClick={() => void download()}>
            {working ? 'Making PDF…' : 'Download NHA statement'}
          </button>
        </>
      )}
    </div>
  )
}

/** "26 Jan" */
function shortDay(date: string): string {
  const [, m, d] = parts(date)
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`
}
