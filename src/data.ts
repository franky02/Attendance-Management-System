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
let pdfPromise: Promise<{ pdf: PdfMod; fonts: Awaited<ReturnType<PdfMod['loadFontsBrowser']>> }> | null = null
const loadPdf = () => (pdfPromise ??= import('./pdf').then(async (pdf) => ({ pdf, fonts: await pdf.loadFontsBrowser() })))

/** Start loading the PDF maker in the background so the first PDF is quick. */
export function preloadPdf() {
  const go = () => { void loadPdf().catch(() => { pdfPromise = null }) }
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 })
  else setTimeout(go, 1000)
}

export async function downloadInterim(start: string, roster: RosterEntry[], marks: Marks, remarks: string, asOf: string) {
  const { pdf, fonts } = await loadPdf()
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
  const { pdf, fonts } = await loadPdf()
  const bytes = await pdf.buildMusterPdf({ periodStart: start, roster, marks, remarks, fonts })
  downloadBytes(bytes, pdf.musterFileName(start), 'application/pdf')
  await db.updatePeriod(start, { final_downloaded_at: new Date().toISOString() })
  return true
}
