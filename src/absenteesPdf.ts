// Absentees statement PDF, matched to reference/ABSENTEES-Statement-BLANK.pdf.
// Geometry was read from that file's drawing instructions. PDF space, origin bottom-left, points.
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import { absenteeRows, isFullPeriod } from './absentees'
import { ddmmyyyy, monthTitle, parts } from './dates'
import { declaration, drawRun, embedFonts, type FontBytes, type FontKey } from './pdf'
import { fileTag, printName } from './stations'
import type { Marks, RosterEntry } from './types'

const PAGE = [612, 792] as const // US Letter, portrait
const RULE = 0.48
// Left edges of the vertical rules: Sl | NAME | Des. | PF No / HRMS | LAP | SICK | CR |
const V = [36.0, 62.52, 245.09, 280.49, 366.91, 426.43, 491.38, 575.62]
const RIGHT = V[7] + RULE
// Bottom edges of the horizontal rules: table top, below heading, then below each of the 16 rows.
const TOP = 705.34
const BELOW_HEAD = 685.06
const ROW_RULES = [650.62, 616.18, 581.74, 547.27, 512.83, 478.39, 443.95, 408.29, 373.85, 339.41, 304.97, 270.5, 236.06, 201.62, 167.18, 132.72]
const BOTTOM = ROW_RULES[15]
const BLACK = rgb(0, 0, 0)

export const ABSENTEE_FONTS: FontKey[] = ['arialBlack', 'calibri', 'calibriBold', 'calibriItalic', 'arial', 'arialBold', 'narrowBold', 'bookmanBold']

// The reference breaks the declaration after "has been"; other station names wrap at the same width.
const DECL_LINE1 = 'All the Employees were physically present while on duty at ENNORE Station, and all leave has been'

export interface AbsenteesInput {
  periodStart: string
  asOf: string
  roster: RosterEntry[]
  marks: Marks
  fonts: FontBytes
  stationName?: string
}

export async function buildAbsenteesPdf(input: AbsenteesInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const f = await embedFonts(doc, input.fonts, ABSENTEE_FONTS)
  const station = input.stationName ?? printName()
  doc.setTitle(`Absentees Statement ${station} ${monthTitle(input.periodStart)}`)
  const page = doc.addPage([...PAGE])
  const text = (s: string, x: number, y: number, font: PDFFont, size: number) => page.drawText(s, { x, y, font, size, color: BLACK })
  const centred = (s: string, l: number, r: number, y: number, font: PDFFont, size: number) =>
    text(s, (l + r) / 2 - font.widthOfTextAtSize(s, size) / 2, y, font, size)
  const fit = (s: string, font: PDFFont, max: number, width: number) =>
    Math.min(max, width / font.widthOfTextAtSize(s, 1))

  // Rows: the frozen roster. Over 16 rows they shrink evenly to end at the same line.
  const n = Math.max(input.roster.length, 1)
  const rowTops = [BELOW_HEAD]
  if (n === 16) rowTops.push(...ROW_RULES)
  else {
    const h = n > 16 ? (BELOW_HEAD - BOTTOM) / n : BELOW_HEAD - ROW_RULES[0]
    for (let i = 1; i <= n; i++) rowTops.push(BELOW_HEAD - h * i)
  }
  const tableBottom = rowTops[n]
  const scale = (i: number) => (rowTops[i] - rowTops[i + 1]) / 34.44

  // Rules
  for (const x of V) page.drawRectangle({ x, y: tableBottom, width: RULE, height: TOP + RULE - tableBottom, color: BLACK })
  for (const y of [TOP, ...rowTops]) page.drawRectangle({ x: V[0], y, width: RIGHT - V[0], height: RULE, color: BLACK })

  // Title
  text('ABSENTEES', 36.0, 738.72, f.arialBlack, 14.04)
  text('Statement', 134.78, 738.72, f.arialBlack, 14.04)
  drawRun(page, [{ t: 'of', font: f.calibri, size: 18 }, { t: `${station} Station staffs`, font: f.calibriBold, size: 18 }], 219.65, 738.72, RIGHT)
  text('for the Month of', 36.0, 718.9, f.calibriItalic, 14.04)
  text(monthTitle(input.periodStart), 136.0, 718.9, f.calibriBold, 14.04)
  if (!isFullPeriod(input.periodStart, input.asOf)) {
    const s = `INTERIM: recorded up to ${ddmmyyyy(input.asOf)}`
    text(s, RIGHT - f.calibriBold.widthOfTextAtSize(s, 12), 718.9, f.calibriBold, 12)
  }

  // Headings
  text('Sl.', 42.72, 691.42, f.arialBold, 11.04)
  text('NAME', 68.16, 691.06, f.arialBold, 12)
  const heads = ['Des.', 'PF No / HRMS', 'LAP', 'SICK', 'CR']
  heads.forEach((h, i) => centred(h, V[i + 2], V[i + 3], 691.42, f.arialBold, 11.04))

  // Rows
  const rows = absenteeRows(input.periodStart, input.asOf, input.roster, input.marks)
  rows.forEach((r, i) => {
    const top = rowTops[i]
    const k = scale(i)
    const base = top - 21.0 * k
    text(`${r.entry.serial}.`, 41.64, base, f.arial, 11.04)
    // Long names print a size smaller, as in the reference; anything still too long shrinks to fit.
    const nameMax = r.entry.full_name.length > 20 ? 11.04 : 12
    text(r.entry.full_name, 68.16, base, f.arialBold, fit(r.entry.full_name, f.arialBold, nameMax, V[2] - 68.16 - 3))
    centred(r.entry.designation, V[2], V[3], base, f.narrowBold, fit(r.entry.designation, f.narrowBold, 11.04, V[3] - V[2] - 4))
    centred(r.entry.pf_hrms_number, V[3], V[4], top - 13.92 * k, f.calibriBold, 11.04)
    centred(r.entry.code, V[3], V[4], top - 28.68 * k, f.bookmanBold, 9.96)
    if (r.lap) centred(String(r.lap), V[4], V[5], base, f.arialBold, 12)
    if (r.sick) centred(String(r.sick), V[5], V[6], base, f.arialBold, 12)
    if (r.cr) centred(String(r.cr), V[6], V[7], base, f.arialBold, 12)
  })

  // Declaration
  const declW = f.calibriBold.widthOfTextAtSize(DECL_LINE1, 12) + 1
  wrapWords(declaration(station), f.calibriBold, 12, declW).slice(0, 3)
    .forEach((line, i) => text(line, 36.0, 97.44 - i * 15.72, f.calibriBold, 12))

  return doc.save()
}

export function absenteesFileName(periodStart: string, asOf: string): string {
  const [y, m] = parts(periodStart)
  const base = `Absentees-${fileTag()}-${y}-${String(m).padStart(2, '0')}`
  return isFullPeriod(periodStart, asOf) ? `${base}-Final.pdf` : `${base}-upto-${asOf}.pdf`
}

function wrapWords(s: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const w of s.split(' ')) {
    const next = line ? `${line} ${w}` : w
    if (!line || font.widthOfTextAtSize(next, size) <= width) line = next
    else { lines.push(line); line = w }
  }
  if (line) lines.push(line)
  return lines
}
