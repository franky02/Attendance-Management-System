// All dates are 'YYYY-MM-DD' strings. Arithmetic is done in UTC so device time zones never shift a date.

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
]
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

export function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

/** Today in Asia/Kolkata, whatever the device's time zone. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

function addMonths(y: number, m: number, k: number): [number, number] {
  const idx = y * 12 + (m - 1) + k
  return [Math.floor(idx / 12), (idx % 12) + 1]
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export interface Period {
  start: string
  end: string
}

export function periodFor(date: string): Period {
  const [y, m, d] = parts(date)
  const [sy, sm] = d >= 16 ? [y, m] : addMonths(y, m, -1)
  const [ey, em] = addMonths(sy, sm, 1)
  return { start: ymd(sy, sm, 16), end: ymd(ey, em, 15) }
}

export function periodFromStart(start: string): Period {
  return periodFor(start)
}

export function shiftPeriod(start: string, k: number): string {
  const [y, m] = parts(start)
  const [ny, nm] = addMonths(y, m, k)
  return ymd(ny, nm, 16)
}

export interface Column {
  label: string // '16' … '31', '01' … '15'
  date: string | null // null = no such date in the start month
}

/** Always 31 columns: 16…31 of the start month, then 01…15 of the next. */
export function periodColumns(start: string): Column[] {
  const [y, m] = parts(start)
  const dim = daysInMonth(y, m)
  const [ny, nm] = addMonths(y, m, 1)
  const cols: Column[] = []
  for (let d = 16; d <= 31; d++) cols.push({ label: pad(d), date: d <= dim ? ymd(y, m, d) : null })
  for (let d = 1; d <= 15; d++) cols.push({ label: pad(d), date: ymd(ny, nm, d) })
  return cols
}

export function periodDates(start: string): string[] {
  return periodColumns(start).flatMap((c) => (c.date ? [c.date] : []))
}

/** "16 Oct to 15 Nov 2026", or "16 Dec 2026 to 15 Jan 2027" across a year. */
export function periodLabel(start: string): string {
  const { end } = periodFor(start)
  const [sy, sm] = parts(start)
  const [ey, em] = parts(end)
  return sy === ey
    ? `16 ${SHORT[sm - 1]} to 15 ${SHORT[em - 1]} ${ey}`
    : `16 ${SHORT[sm - 1]} ${sy} to 15 ${SHORT[em - 1]} ${ey}`
}

/** PDF title: "OCTOBER - NOVEMBER 2026" or "DECEMBER 2026 - JANUARY 2027". */
export function monthTitle(start: string): string {
  const [sy, sm] = parts(start)
  const [ey, em] = addMonths(sy, sm, 1)
  return sy === ey
    ? `${MONTHS[sm - 1]} - ${MONTHS[em - 1]} ${ey}`
    : `${MONTHS[sm - 1]} ${sy} - ${MONTHS[em - 1]} ${ey}`
}

/** Short title for narrow forms: "OCT - NOV 2026" or "DEC 2026 - JAN 2027". */
export function shortMonthTitle(start: string): string {
  const [sy, sm] = parts(start)
  const [ey, em] = addMonths(sy, sm, 1)
  const a = SHORT[sm - 1].toUpperCase(), b = SHORT[em - 1].toUpperCase()
  return sy === ey ? `${a} - ${b} ${ey}` : `${a} ${sy} - ${b} ${ey}`
}

/** Header band: ["OCTOBER 2026", "NOVEMBER 2026"]. */
export function headerMonths(start: string): [string, string] {
  const [sy, sm] = parts(start)
  const [ey, em] = addMonths(sy, sm, 1)
  return [`${MONTHS[sm - 1]} ${sy}`, `${MONTHS[em - 1]} ${ey}`]
}

export function ddmmyyyy(date: string): string {
  const [y, m, d] = parts(date)
  return `${pad(d)}-${pad(m)}-${y}`
}

/** "Mon, 9 Nov 2026" for the Mark screen. */
export function friendlyDate(date: string): string {
  const [y, m, d] = parts(date)
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${wd}, ${d} ${SHORT[m - 1]} ${y}`
}

export function shortDate(date: string): string {
  const [, m, d] = parts(date)
  return `${d} ${SHORT[m - 1]}`
}
