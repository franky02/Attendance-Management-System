// NHA (National Holiday Allowance) statement PDF, built on the layout of
// reference/NHA-Statement-JANUARY-2026-3-colmn.pdf. The NH date columns (and Remarks, when the
// month has a single NH, as in reference/NHA-Statement-SEPTEMBER-2026.pdf) share the space
// between PF No and NHA. PDF space, origin bottom-left, points.
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import { parts } from './dates'
import { nhaCount, nhaRows, nhRemark, type NhResult } from './nha'
import { drawRun, embedFonts, type FontBytes, type FontKey } from './pdf'
import { fileTag, printName } from './stations'
import type { Holiday, Marks, RosterEntry } from './types'

const PAGE = [612, 792] as const // US Letter, portrait
const RULE = 0.48
// Fixed columns: Sl | NAME | Desig | PF No | (NH dates, Remarks) | NHA |
const SL = 36.0, NAME = 62.16, DESIG = 228.29, PF = 272.81, MID = 350.83, NHA = 528.1, END = 565.42
const RIGHT = END + RULE
const TOP = 697.3
const BELOW_HEAD = 648.1
// Below each of 17 rows (16 staff + a numbered spare row in the reference).
const ROW_RULES = [620.98, 593.74, 566.47, 540.19, 512.95, 485.83, 458.59, 431.33, 404.21, 376.97, 349.73, 322.61, 295.37, 269.9, 242.66, 215.54, 188.3]
const STD_ROW = 27.2

const BLACK = rgb(0, 0, 0)
const SKY = rgb(0, 0.69, 0.941) // Eligible
const RED = rgb(0.933, 0, 0) // Not Eligible, NH dates
const MAGENTA = rgb(0.918, 0.0157, 0.855) // the month in the title
const PURPLE = rgb(0.439, 0.188, 0.627) // Remarks for eligible days
const GREY = rgb(0.55, 0.55, 0.55) // Not marked

export const NHA_FONTS: FontKey[] = ['arialBlack', 'calibri', 'calibriBold', 'arial', 'arialBold', 'narrowBold']

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

export interface NhaInput {
  month: string // YYYY-MM-01
  holidays: Holiday[] // the NH dates in that month
  roster: RosterEntry[]
  marks: Marks
  fonts: FontBytes
  stationName?: string
}

export async function buildNhaPdf(input: NhaInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const f = await embedFonts(doc, input.fonts, NHA_FONTS)
  const [y, m] = parts(input.month)
  const monthText = `${MONTHS[m - 1]}’${y}`
  const station = input.stationName ?? printName()
  doc.setTitle(`NHA Statement ${station} ${MONTHS[m - 1]} ${y}`)
  const page = doc.addPage([...PAGE])
  const text = (s: string, x: number, yy: number, font: PDFFont, size: number, color = BLACK) => page.drawText(s, { x, y: yy, font, size, color })
  const centred = (s: string, l: number, r: number, yy: number, font: PDFFont, size: number, color = BLACK) =>
    text(s, (l + r) / 2 - font.widthOfTextAtSize(s, size) / 2, yy, font, size, color)
  const fit = (s: string, font: PDFFont, max: number, width: number) => Math.min(max, width / font.widthOfTextAtSize(s, 1))

  const dates = input.holidays.map((h) => h.holiday_date).sort()
  const withRemarks = dates.length === 1
  // Middle columns: one per NH date, plus Remarks when there is a single NH (widths as in September's sheet).
  const mid: number[] = [MID]
  if (withRemarks) mid.push(MID + (NHA - MID) * 0.555)
  else if (dates.length === 3) mid.push(401.83, 464.95) // January's exact column widths
  else for (let i = 1; i < Math.max(dates.length, 1); i++) mid.push(MID + ((NHA - MID) * i) / Math.max(dates.length, 1))
  const V = [SL, NAME, DESIG, PF, ...mid, NHA, END]
  const midCols: [number, number][] = mid.map((l, i) => [l, mid[i + 1] ?? NHA])

  // Rows: the roster plus one numbered spare row. Over 17 rows they shrink evenly to end at the same line.
  const n = input.roster.length + 1
  const rowTops = [BELOW_HEAD]
  if (n === 17) rowTops.push(...ROW_RULES)
  else {
    const h = n > 17 ? (BELOW_HEAD - ROW_RULES[16]) / n : STD_ROW
    for (let i = 1; i <= n; i++) rowTops.push(BELOW_HEAD - h * i)
  }
  const tableBottom = rowTops[n]

  // Rules
  for (const x of V) page.drawRectangle({ x, y: tableBottom, width: RULE, height: TOP + RULE - tableBottom, color: BLACK })
  for (const yy of [TOP, ...rowTops]) page.drawRectangle({ x: SL, y: yy, width: RIGHT - SL, height: RULE, color: BLACK })

  // Title and subtitle
  text('NHA', 36.0, 738.84, f.arialBlack, 14.04)
  text('Statement', 74.9, 738.84, f.arialBlack, 14.04)
  const mx = drawRun(page, [
    { t: 'of', font: f.calibri, size: 18 },
    { t: `${station} Station staffs`, font: f.calibriBold, size: 15.96 },
    { t: 'for the Month of', font: f.calibri, size: 18 },
  ], 159.74, 738.84, RIGHT - 105) + 0.6
  text(monthText, mx, 738.84, f.calibriBold, fit(monthText, f.calibriBold, 18, RIGHT - mx), MAGENTA)
  text('The following staffs are Eligible/Non-Eligible for National Holiday Allowance.', 36.0, 710.98, f.calibri, 14.04)

  // Headings
  centred('Sl.', SL, NAME, 669.46, f.arialBlack, 11.04)
  centred('NAME', NAME, DESIG, 669.46, f.arialBlack, 12)
  centred('Desig', DESIG, PF, 669.46, f.arialBlack, 11.04)
  centred('PF No', PF, MID, 669.46, f.arialBlack, 11.04)
  dates.forEach((d, i) => {
    const [l, r] = midCols[i]
    const [dy, dm, dd] = parts(d)
    const full = `${String(dd).padStart(2, '0')}-${String(dm).padStart(2, '0')}-${dy}`
    const label = f.calibriBold.widthOfTextAtSize(full, 11.04) <= r - l - 6 ? full : full.slice(0, 6) + full.slice(8)
    centred(label, l, r, 676.3, f.calibriBold, fit(label, f.calibriBold, 11.04, r - l - 4), RED)
    // The holiday's name, small, under its date.
    const name = input.holidays.find((h) => h.holiday_date === d)?.name?.trim()
    if (name) centred(name, l, r, 661, f.calibri, fit(name, f.calibri, 9, r - l - 4))
  })
  if (withRemarks) centred('Remarks', ...midCols[1], 669.46, f.calibriBold, 11.04)
  centred('NHA', NHA, END, 677.98, f.calibriBold, 14.04)

  // Rows
  const rows = nhaRows(dates, input.roster, input.marks)
  for (let i = 0; i < n; i++) {
    const top = rowTops[i]
    const h = top - rowTops[i + 1]
    const base = top - h / 2 - 3.4 // the reference's baselines sit 17.16 pt below a 27.2 pt row top
    text(`${i + 1}.`, 41.64, base, f.arial, 11.04)
    const r = rows[i]
    if (!r) continue // the spare row
    const nameMax = r.entry.full_name.length > 20 ? 11.04 : 12
    text(r.entry.full_name, 67.8, base, f.arialBold, fit(r.entry.full_name, f.arialBold, nameMax, DESIG - 67.8 - 3))
    text(r.entry.designation, 233.93, base, f.narrowBold, fit(r.entry.designation, f.narrowBold, 11.04, PF - 233.93 - 3))
    text(r.entry.pf_hrms_number, 278.45, base, f.calibriBold, fit(r.entry.pf_hrms_number, f.calibriBold, 11.04, MID - 278.45 - 3))
    r.results.forEach((res, j) => {
      const [l, rr] = midCols[j]
      const word = WORD[res.result]
      centred(word, l, rr, base, f.calibriBold, fit(word, f.calibriBold, 11.04, rr - l - 4), COLOUR[res.result])
    })
    if (withRemarks) {
      const res = r.results[0]
      const word = nhRemark(res.code)
      const colour = res.result === 'eligible' ? PURPLE : res.result === 'unmarked' ? GREY : RED
      centred(word, ...midCols[1], base, f.calibriBold, fit(word, f.calibriBold, 11.04, midCols[1][1] - midCols[1][0] - 4), colour)
    }
    centred(nhaCount(r.count), NHA, END, base - 0.9, f.calibriBold, 14.04)
  }

  return doc.save()
}

const WORD: Record<NhResult, string> = { eligible: 'Eligible', ineligible: 'Not Eligible', unmarked: 'Not marked' }
const COLOUR: Record<NhResult, ReturnType<typeof rgb>> = { eligible: SKY, ineligible: RED, unmarked: GREY }

export function nhaFileName(month: string): string {
  const [y, m] = parts(month)
  return `NHA-${fileTag()}-${y}-${String(m).padStart(2, '0')}.pdf`
}
