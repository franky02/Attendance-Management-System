// Builds sample PDFs from seed data (with sample marks) and an overlay on the reference.
// Usage: npm run sample-pdf   → out/sample-final.pdf, out/sample-interim.pdf, out/overlay.pdf
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { buildMusterPdf, FONT_FILES, type FontBytes } from '../src/pdf'
import { buildAbsenteesPdf } from '../src/absenteesPdf'
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

// Overlay: reference in place, sample on top at the same scale.
const overlay = await PDFDocument.create()
const [ref] = await overlay.embedPdf(readFileSync('reference/MUSTER-2026-1.pdf'))
const [mine] = await overlay.embedPdf(final)
const page = overlay.addPage([ref.width, ref.height])
page.drawPage(ref)
page.drawPage(mine, { opacity: 0.5 })
writeFileSync('out/overlay.pdf', await overlay.save())
// Absentees statement, up to the 24th day, plus an overlay on the blank reference.
const abs = await buildAbsenteesPdf({ periodStart: start, asOf: periodDates(start)[23], roster, marks, fonts })
writeFileSync('out/sample-absentees.pdf', abs)
const absFull = await buildAbsenteesPdf({ periodStart: start, asOf: periodDates(start).at(-1)!, roster, marks, fonts })
const ov2 = await PDFDocument.create()
const [ref2] = await ov2.embedPdf(readFileSync('reference/ABSENTEES-Statement-BLANK.pdf'))
const [mine2] = await ov2.embedPdf(absFull)
const p2 = ov2.addPage([ref2.width, ref2.height])
p2.drawPage(ref2)
p2.drawPage(mine2, { opacity: 0.5 })
writeFileSync('out/overlay-absentees.pdf', await ov2.save())
console.log('wrote out/sample-absentees.pdf, out/overlay-absentees.pdf')
console.log('wrote out/sample-final.pdf, out/sample-interim.pdf, out/overlay.pdf')
