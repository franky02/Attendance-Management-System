import { useEffect, useState } from 'react'
import { db, refreshCurrentRoster } from './db'
import { getState, refreshMeta } from './store'
import { downloadBytes } from './download'
import { feedback, setFeedback, useFeedbackSettings } from './feedback'
import type { Employee } from './types'

type Draft = Omit<Employee, 'id'> & { id?: string }

export function StaffScreen({ today }: { today: string }) {
  // Shows the copy on the phone at once, then refreshes.
  const [staff, setStaff] = useState<Employee[]>(() => getState().employees)
  const [edit, setEdit] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try { await refreshMeta(); setStaff(getState().employees); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  useEffect(() => { void load() }, [])

  const persist = async (rows: Draft[]) => {
    // Update the list at once for existing staff; the server catches up.
    const before = staff
    setStaff((list) => list.map((s) => ({ ...s, ...rows.find((r) => r.id === s.id) })).sort((a, b) => a.display_order - b.display_order))
    try {
      await Promise.all(rows.map((r) => db.saveEmployee(r)))
      await refreshCurrentRoster(today)
      await load()
      return true
    } catch (e) {
      setStaff(before)
      alert('Could not save: ' + (e instanceof Error ? e.message : e))
      return false
    }
  }

  const active = staff.filter((s) => !s.left_on)
  const left = staff.filter((s) => s.left_on)

  const move = (i: number, dir: -1 | 1) => {
    const a = active[i], b = active[i + dir]
    if (!a || !b) return
    void persist([{ ...a, display_order: b.display_order }, { ...b, display_order: a.display_order }])
  }

  const startAdd = () => setEdit({
    full_name: '', designation: '', pf_hrms_number: '', code: '',
    display_order: Math.max(0, ...staff.map((s) => s.display_order)) + 1, left_on: null,
  })

  const exportAll = async () => {
    try {
      const data = await db.exportAll()
      downloadBytes(JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2),
        `ennore-muster-backup-${today}.json`, 'application/json')
    } catch (e) {
      alert('Could not export: ' + (e instanceof Error ? e.message : e))
    }
  }

  if (edit) {
    const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setEdit({ ...edit, [k]: e.target.value })
    return (
      <div className="screen">
        <h2>{edit.id ? 'Edit staff' : 'Add staff'}</h2>
        <p className="muted">Type exactly as printed. Spaces and letters are kept as you type them.</p>
        <label className="field"><span>Full name</span><input value={edit.full_name} onChange={set('full_name')} autoCapitalize="characters" /></label>
        <label className="field"><span>Designation (e.g. SS, SM, PM-A)</span><input value={edit.designation} onChange={set('designation')} autoCapitalize="characters" /></label>
        <label className="field"><span>PF / HRMS number</span><input value={edit.pf_hrms_number} onChange={set('pf_hrms_number')} autoCapitalize="characters" autoCorrect="off" spellCheck={false} /></label>
        <label className="field"><span>Code</span><input value={edit.code} onChange={set('code')} autoCapitalize="characters" autoCorrect="off" spellCheck={false} /></label>
        {edit.id && (
          <label className="field">
            <span>Left on (leave empty if still working)</span>
            <input type="date" value={edit.left_on ?? ''} onChange={(e) => setEdit({ ...edit, left_on: e.target.value || null })} />
          </label>
        )}
        <div className="row-btns">
          <button className="big-btn secondary" onClick={() => setEdit(null)}>Cancel</button>
          <button
            className="big-btn"
            disabled={!edit.full_name.trim() || !edit.designation.trim()}
            onClick={async () => { if (await persist([edit])) setEdit(null) }}
          >Save</button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      {error && <div className="error-box">Could not load: {error} <button onClick={load}>Retry</button></div>}
      <div className="staff-list">
        {active.map((s, i) => (
          <div key={s.id} className="staff-row">
            <div className="who" onClick={() => setEdit(s)}>
              <div className="name">{i + 1}. {s.full_name}</div>
              <div className="muted">{s.designation} · {s.pf_hrms_number} · {s.code}</div>
            </div>
            <div className="staff-btns">
              <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
              <button className="icon-btn" aria-label="Move down" disabled={i === active.length - 1} onClick={() => move(i, 1)}>▼</button>
              <button className="small-btn" onClick={() => setEdit(s)}>Edit</button>
              <button className="small-btn" onClick={() => {
                if (confirm(`Mark ${s.full_name} as left today? They stay on this period's muster.`)) void persist([{ ...s, left_on: today }])
              }}>Left</button>
            </div>
          </div>
        ))}
      </div>
      <button className="big-btn" onClick={startAdd}>+ Add staff</button>

      {left.length > 0 && (
        <>
          <h3>Left</h3>
          <div className="staff-list">
            {left.map((s) => (
              <div key={s.id} className="staff-row left">
                <div className="who" onClick={() => setEdit(s)}>
                  <div className="name">{s.full_name}</div>
                  <div className="muted">{s.designation} · left {s.left_on}</div>
                </div>
                <button className="small-btn" onClick={() => setEdit(s)}>Edit</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="backup">
        <h3>Sound &amp; vibration</h3>
        <FeedbackSwitches />
      </div>

      <div className="backup">
        <h3>Backup</h3>
        <p className="muted">Saves all staff, periods and attendance to one file. Do this now and then and keep the file safe.</p>
        <button className="big-btn secondary" onClick={exportAll}>Download all data</button>
      </div>
    </div>
  )
}

/** On/off switches for the click sounds and vibration. */
function FeedbackSwitches() {
  const s = useFeedbackSettings()
  const row = (label: string, hint: string, on: boolean, flip: () => void) => (
    <button type="button" role="switch" aria-checked={on} data-fb="off" className={'fb-switch' + (on ? ' on' : '')} onClick={flip}>
      <span className="fb-text"><b>{label}</b><small>{hint}</small></span>
      <span className="fb-knob" aria-hidden="true" />
    </button>
  )
  return (
    <div className="fb-box">
      {row('Click sounds', 'Soft clicks and ticks when tapping and scrolling', s.sound, () => { setFeedback({ sound: !s.sound }); if (!s.sound) feedback('tap') })}
      {row('Vibration', 'A light buzz with each tap (Android phones)', s.haptics, () => { setFeedback({ haptics: !s.haptics }); if (!s.haptics) feedback('tap') })}
    </div>
  )
}
