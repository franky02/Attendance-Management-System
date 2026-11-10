// Emails the owner when an ended period's final muster has not been downloaded.
// Deploy with: supabase functions deploy notify-muster-ready --no-verify-jwt
// Secrets: RESEND_API_KEY, ALERT_EMAIL, APP_URL, CRON_SECRET, optional RESEND_FROM.
// No employee data and no attachment goes in the email.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

function label(start: string, end: string): string {
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  return sy === ey
    ? `16 ${SHORT[sm - 1]} to 15 ${SHORT[em - 1]} ${ey}`
    : `16 ${SHORT[sm - 1]} ${sy} to 15 ${SHORT[em - 1]} ${ey}`
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000) + 1
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('Forbidden', { status: 403 })
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: periods, error } = await db
    .from('period')
    .select('start_date,end_date,roster')
    .lt('end_date', todayIST())
    .is('final_downloaded_at', null)
    .order('start_date', { ascending: false })
    .limit(1)
  if (error) return new Response(error.message, { status: 500 })
  const p = periods?.[0]
  if (!p) return new Response('Nothing to send')

  const ids: string[] = (p.roster as { employee_id: string }[]).map((r) => r.employee_id)
  const { count, error: e2 } = await db
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .gte('att_date', p.start_date)
    .lte('att_date', p.end_date)
    .in('employee_id', ids)
  if (e2) return new Response(e2.message, { status: 500 })
  const unmarked = ids.length * daysBetween(p.start_date, p.end_date) - (count ?? 0)

  const subject = `Muster for ${label(p.start_date, p.end_date)} is ready`
  const text = `${subject}. ${unmarked} entries are unmarked. Open the app: ${Deno.env.get('APP_URL')}`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') ?? 'ENNORE Muster <onboarding@resend.dev>',
      to: [Deno.env.get('ALERT_EMAIL')],
      subject,
      text,
    }),
  })
  return new Response(await res.text(), { status: res.ok ? 200 : 502 })
})
