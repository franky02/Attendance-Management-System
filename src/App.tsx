import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db, supabase } from './db'
import { todayIST } from './dates'
import { MarkScreen } from './MarkScreen'
import { MusterScreen } from './MusterScreen'
import { StaffScreen } from './StaffScreen'
import { AbsenteesScreen } from './AbsenteesScreen'
import { NightDutyScreen } from './NightDutyScreen'
import { NhScreen } from './NhScreen'
import { useSaveState } from './saver'
import { useZoom } from './zoom'

type Tab = 'mark' | 'muster' | 'absentees' | 'night' | 'nh' | 'staff'

// Line icons for the bottom tab bar (drawn here, no icon library).
const TAB_ICONS: Record<Tab, React.ReactNode> = {
  mark: <><circle cx="12" cy="12" r="8.5" /><path d="M8.2 12.4l2.6 2.6 5-5.2" /></>,
  muster: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M9.5 9.5v10M15 9.5v10" /></>,
  absentees: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M9.5 15h5" /></>,
  night: <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z" />,
  nh: <><path d="M5.5 21V4M5.5 4.5h11l-2 3.75 2 3.75h-11" /></>,
  staff: <><circle cx="9.5" cy="8.5" r="3.3" /><path d="M3.5 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5M15.6 5.4a3.2 3.2 0 0 1 0 6.2M17.4 14.8c1.7.6 2.8 2.2 3.1 4.7" /></>,
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (supabase && session === undefined) return <div className="center muted">Loading…</div>
  if (supabase && !session) return <Login />
  return <Main />
}

function Main() {
  const [tab, setTab] = useState<Tab>('mark')
  const [today, setToday] = useState(todayIST())
  const save = useSaveState()
  const z = useZoom()
  useEffect(() => { document.documentElement.style.setProperty('--z', String(z.zoom)) }, [z.zoom])

  // Roll over to the new day if the app is left open past midnight.
  useEffect(() => {
    const t = setInterval(() => setToday(todayIST()), 60000)
    const onVis = () => setToday(todayIST())
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  return (
    <div className="app">
      <header className="top">
        <div className="top-row">
          <button className="zoom-btn" onClick={z.zoomOut} disabled={!z.canOut} aria-label="Zoom out (smaller)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L20 20M7.5 10.5h6" /></svg>
          </button>
          <div className="title"><AppName /></div>
          <button className="zoom-btn" onClick={z.zoomIn} disabled={!z.canIn} aria-label="Zoom in (bigger)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L20 20M7.5 10.5h6M10.5 7.5v6" /></svg>
          </button>
        </div>
        <div className={'save-state ' + save.state}>
          {save.state === 'saving' && 'Saving…'}
          {save.state === 'saved' && '✓ Saved'}
          {save.state === 'error' && `Not saved (${save.failed}) · retrying`}
        </div>
      </header>
      {db.demo && <div className="demo-bar">Demo mode: data is kept in this browser only.</div>}
      <main style={{ zoom: z.zoom }}>
        {tab === 'mark' && <MarkScreen today={today} />}
        {tab === 'muster' && <MusterScreen today={today} />}
        {tab === 'absentees' && <AbsenteesScreen today={today} />}
        {tab === 'night' && <NightDutyScreen today={today} />}
        {tab === 'nh' && <NhScreen today={today} />}
        {tab === 'staff' && <StaffScreen today={today} />}
      </main>
      <nav className="tabs">
        {([['mark', 'Mark'], ['muster', 'Muster'], ['absentees', 'Absentees'], ['night', 'Night Duty'], ['nh', 'NH'], ['staff', 'Staff']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{TAB_ICONS[t]}</svg>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

/** The app's name: Playfair Display, with "Ennore" in a Didone italic (fonts in public/fonts). */
function AppName() {
  return <>Attendance Management System for <em>Ennore</em> Station</>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError('Could not sign in. Check the email and password.')
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1 className="title-big"><AppName /></h1>
      <div className="login-card">
      <label className="field"><span>Email</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      </div>
      {error && <div className="error-box">{error}</div>}
      <button className="big-btn" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}
