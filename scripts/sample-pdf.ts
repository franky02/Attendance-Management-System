// Builds sample PDFs from seed data (with sample marks) and an overlay on the reference.
// Usage: npm run sample-pdf   → out/sample-final.pdf, out/sample-interim.pdf, out/overlay.pdf
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { buildMusterPdf, FONT_FILES, type FontBytes } from '../src/pdf'
import { buildAbsenteesPdf } from '../src/absenteesPdf'
import { buildNdaPdf } from '../src/ndaPdf'
import { buildNhaPdf } from '../src/nhaPdf'
import { SEED_STAFF } from '../src/seed'
import { periodDates } from '../src/dates'
import { key, type Marks, type RosterEntry } from '../src/types'

const fonts = Object.fromEntries(
  Object.entries(FONT_FILES).map(([k, file]) => [k, readFileSync(`public/fonts/${file}`)]),
) as unknown as FontBytes

const roster: RosterEntry[] = SEED_STAFF.map(([full_name, designation, pf_hrms_number, code], i) => ({
  employee_id: `e${i + 1}`, serial: i + 1, full_name, designation, pf_hrms_number, code,
}))

const start = process.argv[2] ?? '2026-10-16'
const marks: Marks = {}
periodDates(start).forEach((d, di) => {
  roster.forEach((r, ri) => {
    if ((di + ri) % 11 === 5) return // a few blanks
    const leaves = ['A', 'CL', 'LAP', 'S', 'CR', 'LAP', 'S', 'CR', 'CCLSF', 'WRIIL']
    marks[key(r.employee_id, d)] = (di + ri) % 7 === 0 ? 'R' : (di * 3 + ri) % 13 === 0 ? leaves[(di + ri) % leaves.length] : 'P'
  })
})

mkdirSync('out', { recursive: true })
const final = await buildMusterPdf({ periodStart: start, roster, marks, remarks: 'Sample remarks text.', fonts })
writeFileSync('out/sample-final.pdf', final)
const interim = await buildMusterPdf({ periodStart: start, roster, marks, remarks: '', asOf: periodDates(start)[23], fonts })
writeFileSync('out/sample-interim.pdf', interim)

// Overlays need the official forms in reference/ (kept private, not in the repo); skipped if absent.
const haveRef = (f: string) => existsSync(f)
// Overlay: reference in place, sample on top at the same scale.
if (haveRef('reference/MUSTER-2026-1.pdf')) {
const overlay = await PDFDocument.create()
const [ref] = await overlay.embedPdf(readFileSync('reference/MUSTER-2026-1.pdf'))
const [mine] = await overlay.embedPdf(final)
const page = overlay.addPage([ref.width, ref.height])
page.drawPage(ref)
page.drawPage(mine, { opacity: 0.5 })
writeFileSync('out/overlay.pdf', await overlay.save())
}
// Absentees statement, up to the 24th day, plus an overlay on the blank reference.
const abs = await buildAbsenteesPdf({ periodStart: start, asOf: periodDates(start)[23], roster, marks, fonts })
writeFileSync('out/sample-absentees.pdf', abs)
const absFull = await buildAbsenteesPdf({ periodStart: start, asOf: periodDates(start).at(-1)!, roster, marks, fonts })
if (haveRef('reference/ABSENTEES-Statement-BLANK.pdf')) {
const ov2 = await PDFDocument.create()
const [ref2] = await ov2.embedPdf(readFileSync('reference/ABSENTEES-Statement-BLANK.pdf'))
const [mine2] = await ov2.embedPdf(absFull)
const p2 = ov2.addPage([ref2.width, ref2.height])
p2.drawPage(ref2)
p2.drawPage(mine2, { opacity: 0.5 })
writeFileSync('out/overlay-absentees.pdf', await ov2.save())
}
// NDA statement with sample hours, plus an overlay on the blank reference.
const entries = roster.map((r, i) => ({
  period_start: '2026-10-01', employee_id: r.employee_id, roster: i === 3 ? 'Shift' : 'Cont.',
  hours: i % 5 === 4 ? null : [48, 50, 51, 36, 60, 72, 12.5][i % 7],
  remarks: i === 1 ? 'Relieving duty at EN cabin' : i === 6 ? 'Includes 2 nights at another station for training and relief work' : '',
}))
const nda = await buildNdaPdf({ month: '2026-10-01', roster, entries, fonts })
writeFileSync('out/sample-nda.pdf', nda)
if (haveRef('reference/NDA-BLANK-2026.pdf')) {
const ov3 = await PDFDocument.create()
const [ref3] = await ov3.embedPdf(readFileSync('reference/NDA-BLANK-2026.pdf'))
const [mine3] = await ov3.embedPdf(nda)
const p3 = ov3.addPage([ref3.width, ref3.height])
p3.drawPage(ref3)
p3.drawPage(mine3, { opacity: 0.5 })
writeFileSync('out/overlay-nda.pdf', await ov3.save())
}
// NHA statements: January-like (3 NHs) and September-like (1 NH, with Remarks), with overlays.
const nhMarks: Marks = {}
const janDates = ['2026-01-01', '2026-01-15', '2026-01-26']
roster.forEach((r, i) => {
  nhMarks[key(r.employee_id, '2026-01-01')] = 'P'
  nhMarks[key(r.employee_id, '2026-01-15')] = [6, 8, 11, 13].includes(i) ? 'NH' : i === 2 ? 'R' : 'P'
  nhMarks[key(r.employee_id, '2026-01-26')] = i === 15 ? 'LAP' : i === 4 ? 'CR' : 'P'
  nhMarks[key(r.employee_id, '2026-09-14')] = i === 2 ? 'LAP' : [10, 12].includes(i) ? 'NH' : i === 5 ? undefined as unknown as string : 'P'
})
delete nhMarks[key(roster[5].employee_id, '2026-09-14')]
const janHol = janDates.map((d, i) => ({ holiday_date: d, name: ['New Year', 'Pongal', 'Republic Day'][i] }))
for (const [name, month, hols, ref] of [
  ['jan', '2026-01-01', janHol, 'reference/NHA-Statement-JANUARY-2026-3-colmn.pdf'],
  ['sep', '2026-09-01', [{ holiday_date: '2026-09-14', name: '' }], 'reference/NHA-Statement-SEPTEMBER-2026.pdf'],
] as const) {
  const bytes = await buildNhaPdf({ month, holidays: [...hols], roster, marks: nhMarks, fonts })
  writeFileSync(`out/sample-nha-${name}.pdf`, bytes)
  if (!haveRef(ref)) continue
  const ov = await PDFDocument.create()
  const [rp] = await ov.embedPdf(readFileSync(ref))
  const [mp] = await ov.embedPdf(bytes)
  const pg = ov.addPage([rp.width, rp.height])
  pg.drawPage(rp)
  pg.drawPage(mp, { opacity: 0.5 })
  writeFileSync(`out/overlay-nha-${name}.pdf`, await ov.save())
}
console.log('wrote out/sample-nha-jan.pdf, out/sample-nha-sep.pdf and overlays')
console.log('wrote out/sample-nda.pdf, out/overlay-nda.pdf')
console.log('wrote out/sample-absentees.pdf, out/overlay-absentees.pdf')
console.log('wrote out/sample-final.pdf, out/sample-interim.pdf, out/overlay.pdf')
