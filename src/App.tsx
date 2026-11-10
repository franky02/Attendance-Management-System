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
        <div className="title">ENNORE Muster</div>
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
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
        ))}
      </nav>
    </div>
  )
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
      <h1>ENNORE Muster</h1>
      <label className="field"><span>Email</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <div className="error-box">{error}</div>}
      <button className="big-btn" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}
