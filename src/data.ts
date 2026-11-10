import { db, rosterFor } from './db'
import { periodDates, periodFor } from './dates'
import { downloadBytes } from './download'
import { key, type Marks, type RosterEntry } from './types'

export function countUnmarked(start: string, roster: RosterEntry[], marks: Marks): number {
  let n = 0
  for (const d of periodDates(start)) for (const r of roster) if (!marks[key(r.employee_id, d)]) n++
  return n
}

// The PDF code and fonts load only when a PDF is first made, so the app opens fast.
type PdfMod = typeof import('./pdf')
let pdfPromise: Promise<PdfMod> | null = null
const loadPdf = () => (pdfPromise ??= import('./pdf').catch((e) => { pdfPromise = null; throw e }))
async function musterKit() {
  const pdf = await loadPdf()
  return { pdf, fonts: await pdf.loadFontsBrowser(pdf.MUSTER_FONTS) }
}
async function absenteesKit() {
  const [pdf, abs] = await Promise.all([loadPdf(), import('./absenteesPdf')])
  return { abs, fonts: await pdf.loadFontsBrowser(abs.ABSENTEE_FONTS) }
}

/** Start loading a PDF maker in the background so the first PDF is quick. */
export function preloadPdf(kind: 'muster' | 'absentees' = 'muster') {
  const go = () => { void (kind === 'muster' ? musterKit() : absenteesKit()).catch(() => {}) }
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 })
  else setTimeout(go, 1000)
}

export async function downloadAbsentees(start: string, asOf: string, roster: RosterEntry[], marks: Marks) {
  const { abs, fonts } = await absenteesKit()
  const bytes = await abs.buildAbsenteesPdf({ periodStart: start, asOf, roster, marks, fonts })
  downloadBytes(bytes, abs.absenteesFileName(start, asOf), 'application/pdf')
}

export async function downloadInterim(start: string, roster: RosterEntry[], marks: Marks, remarks: string, asOf: string) {
  const { pdf, fonts } = await musterKit()
  const bytes = await pdf.buildMusterPdf({ periodStart: start, roster, marks, remarks, asOf, fonts })
  downloadBytes(bytes, pdf.musterFileName(start, asOf), 'application/pdf')
}

/** Final PDF for an ended period. Asks first if entries are unmarked. Returns true if downloaded. */
export async function downloadFinal(start: string): Promise<boolean> {
  const { end } = periodFor(start)
  const [employees, periods, rows] = await Promise.all([db.getEmployees(), db.getPeriods(), db.getAttendance(start, end)])
  const roster = rosterFor(start, periods, employees)
  const marks: Marks = {}
  for (const r of rows) marks[key(r.employee_id, r.att_date)] = r.status
  const n = countUnmarked(start, roster, marks)
  if (n > 0 && !window.confirm(`${n} entries are unmarked and will print blank. Download anyway?`)) return false
  const remarks = periods.find((p) => p.start_date === start)?.remarks ?? ''
  const { pdf, fonts } = await musterKit()
  const bytes = await pdf.buildMusterPdf({ periodStart: start, roster, marks, remarks, fonts })
  downloadBytes(bytes, pdf.musterFileName(start), 'application/pdf')
  await db.updatePeriod(start, { final_downloaded_at: new Date().toISOString() })
  return true
}
