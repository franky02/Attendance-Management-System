import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db, supabase } from './db'
import { todayIST } from './dates'
import { MarkScreen } from './MarkScreen'
import { MusterScreen } from './MusterScreen'
import { StaffScreen } from './StaffScreen'
import { AbsenteesScreen } from './AbsenteesScreen'
import { useSaveState } from './saver'

type Tab = 'mark' | 'muster' | 'absentees' | 'staff'

// Line icons for the bottom tab bar (drawn here, no icon library).
const TAB_ICONS: Record<Tab, React.ReactNode> = {
  mark: <><circle cx="12" cy="12" r="8.5" /><path d="M8.2 12.4l2.6 2.6 5-5.2" /></>,
  muster: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M9.5 9.5v10M15 9.5v10" /></>,
  absentees: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M9.5 15h5" /></>,
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
        <div className="title"><AppName /></div>
        <div className={'save-state ' + save.state}>
          {save.state === 'saving' && 'Saving…'}
          {save.state === 'saved' && '✓ Saved'}
          {save.state === 'error' && `Not saved (${save.failed}) · retrying`}
        </div>
      </header>
      {db.demo && <div className="demo-bar">Demo mode: data is kept in this browser only.</div>}
      <main>
        {tab === 'mark' && <MarkScreen today={today} />}
        {tab === 'muster' && <MusterScreen today={today} />}
        {tab === 'absentees' && <AbsenteesScreen today={today} />}
        {tab === 'staff' && <StaffScreen today={today} />}
      </main>
      <nav className="tabs">
        {([['mark', 'Mark'], ['muster', 'Muster'], ['absentees', 'Absentees'], ['staff', 'Staff']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{TAB_ICONS[t]}</svg>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

/** The app's name, with "Ennore" in the italic accent face. */
function AppName() {
  return <>Muster Roll for <em>Ennore</em> Station</>
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
