// NDA (Night Duty) statement PDF, matched to reference/NDA-BLANK-2026.pdf.
// Geometry was read from that file's drawing instructions. PDF space, origin bottom-left, points.
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import { monthName, parts } from './dates'
import { DEFAULT_ROSTER, fmtNumber, fmtWeighted } from './nightDuty'
import { drawRun, embedFonts, type FontBytes, type FontKey } from './pdf'
import { fileTag, printName } from './stations'
import type { NightDutyRow, RosterEntry } from './types'

const PAGE = [612, 792] as const // US Letter, portrait
const RULE = 0.48
// Left edges of the vertical rules: Sl | NAME | Des | PF No | Roster | Total Hrs. | Weighted Hrs. | Remarks |
const V = [36.0, 62.16, 242.81, 281.81, 359.95, 413.95, 457.15, 516.58, 570.7]
const RIGHT = V[8] + RULE
// Bottom edges of the horizontal rules: table top, below heading, then below each of the 16 rows.
const TOP = 696.94
const BELOW_HEAD = 665.02
const ROW_RULES = [637.78, 610.66, 583.42, 557.11, 529.87, 502.63, 475.51, 448.27, 421.01, 393.89, 366.65, 339.53, 312.29, 286.82, 259.58, 232.34]
const STD_ROW = 27.24
const BLACK = rgb(0, 0, 0)

export const NDA_FONTS: FontKey[] = ['arialBlack', 'calibri', 'calibriBold', 'arial', 'arialBold', 'narrowBold']

export interface NdaInput {
  /** Calendar month, as its 1st day (YYYY-MM-01). Night duty is not tied to the 16th–15th muster period. */
  month: string
  roster: RosterEntry[]
  entries: NightDutyRow[]
  fonts: FontBytes
  stationName?: string
}

export async function buildNdaPdf(input: NdaInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const f = await embedFonts(doc, input.fonts, NDA_FONTS)
  const station = input.stationName ?? printName()
  doc.setTitle(`NDA Statement ${station} ${monthName(input.month)}`)
  const page = doc.addPage([...PAGE])
  const text = (s: string, x: number, y: number, font: PDFFont, size: number) => page.drawText(s, { x, y, font, size, color: BLACK })
  const centred = (s: string, l: number, r: number, y: number, font: PDFFont, size: number) =>
    text(s, (l + r) / 2 - font.widthOfTextAtSize(s, size) / 2, y, font, size)
  const fit = (s: string, font: PDFFont, max: number, width: number) => Math.min(max, width / font.widthOfTextAtSize(s, 1))

  // Rows: the frozen roster. Over 16 rows they shrink evenly to end at the same line.
  const n = Math.max(input.roster.length, 1)
  const rowTops = [BELOW_HEAD]
  if (n === 16) rowTops.push(...ROW_RULES)
  else {
    const h = n > 16 ? (BELOW_HEAD - ROW_RULES[15]) / n : STD_ROW
    for (let i = 1; i <= n; i++) rowTops.push(BELOW_HEAD - h * i)
  }
  const tableBottom = rowTops[n]

  // Rules
  for (const x of V) page.drawRectangle({ x, y: tableBottom, width: RULE, height: TOP + RULE - tableBottom, color: BLACK })
  for (const y of [TOP, ...rowTops]) page.drawRectangle({ x: V[0], y, width: RIGHT - V[0], height: RULE, color: BLACK })

  // Title
  text('NDA', 40.68, 711.34, f.arialBlack, 14.04)
  text('Statement', 78.86, 711.34, f.arialBlack, 14.04)
  // The title fills most of the line: the lead shrinks only for long station names, then the month fits the rest.
  const mx = drawRun(page, [{ t: `of ${station} Station staffs for the Month of`, font: f.calibri, size: 15.96 }], 163.58, 711.34, RIGHT - 95) - 0.5
  const month = monthName(input.month)
  text(month, mx, 711.34, f.calibriBold, fit(month, f.calibriBold, 15.96, RIGHT - mx))

  // Headings
  centred('Sl.', V[0], V[1], 678.7, f.arialBlack, 11.04)
  centred('NAME', V[1], V[2], 677.62, f.arialBlack, 12)
  centred('Des', V[2], V[3], 678.7, f.arialBlack, 11.04)
  centred('PF No', V[3], V[4], 678.7, f.arialBlack, 11.04)
  centred('Roster', V[4], V[5], 677.14, f.calibriBold, 12)
  centred('Total', V[5], V[6], 684.46, f.calibriBold, 12)
  centred('Hrs.', V[5], V[6], 669.82, f.calibriBold, 12)
  centred('Weighted', V[6], V[7], 684.46, f.calibriBold, 12)
  centred('Hrs.', V[6], V[7], 669.82, f.calibriBold, 12)
  centred('Remarks', V[7], V[8], 677.14, f.calibriBold, 12)

  // Rows
  const byId = new Map(input.entries.map((e) => [e.employee_id, e]))
  input.roster.forEach((r, i) => {
    const top = rowTops[i]
    const h = top - rowTops[i + 1]
    const base = top - h / 2 - 3.6 // the reference's baselines sit 17.2 pt below a 27.24 pt row top
    const e = byId.get(r.employee_id)
    centred(`${r.serial}.`, V[0], V[1], base, f.arial, 11.04)
    const nameMax = r.full_name.length > 20 ? 11.04 : 12
    text(r.full_name, 67.8, base, f.arialBold, fit(r.full_name, f.arialBold, nameMax, V[2] - 67.8 - 3))
    centred(r.designation, V[2], V[3], base, f.narrowBold, fit(r.designation, f.narrowBold, 11.04, V[3] - V[2] - 4))
    text(r.pf_hrms_number, 287.45, base, f.calibriBold, fit(r.pf_hrms_number, f.calibriBold, 11.04, V[4] - 287.45 - 3))
    centred(DEFAULT_ROSTER, V[4], V[5], base, f.calibriBold, 11.04) // Roster is always Cont.
    if (e?.hours != null) {
      centred(fmtNumber(Number(e.hours)), V[5], V[6], base, f.calibriBold, 12)
      centred(fmtWeighted(Number(e.hours)), V[6], V[7], base, f.calibriBold, 12)
    }
    if (e?.remarks?.trim()) drawRemarks(e.remarks.trim(), top, rowTops[i + 1])
  })

  return doc.save()

  /** Remarks: up to 2 lines in the narrow last column, shrinking to fit. */
  function drawRemarks(s: string, top: number, bottom: number) {
    const width = V[8] - V[7] - 4
    for (const size of [10, 9, 8, 7, 6]) {
      const lines = wrap(s, f.calibri, size, width)
      const lead = size * 1.1
      if (lines.length <= 2 && lines.length * lead <= top - bottom - 2 && lines.every((l) => f.calibri.widthOfTextAtSize(l, size) <= width)) {
        const first = (top + bottom) / 2 + ((lines.length - 1) * lead) / 2 - size * 0.35
        lines.forEach((l, i) => centred(l, V[7], V[8], first - i * lead, f.calibri, size))
        return
      }
    }
    // Too long: two lines at 6 pt, cut with an ellipsis.
    const lines = wrap(s, f.calibri, 6, width).slice(0, 2)
    let last = lines[1] ?? ''
    while (last && f.calibri.widthOfTextAtSize(last + '…', 6) > width) last = last.slice(0, -1)
    if (lines.length === 2) lines[1] = last + '…'
    const first = (top + bottom) / 2 + 3.3 - 6 * 0.35
    lines.forEach((l, i) => centred(l, V[7], V[8], first - i * 6.6, f.calibri, 6))
  }
}

function wrap(s: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of s.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (!line || font.widthOfTextAtSize(next, size) <= width) line = next
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

export function ndaFileName(month: string): string {
  const [y, m] = parts(month)
  return `NDA-${fileTag()}-${y}-${String(m).padStart(2, '0')}.pdf`
}
