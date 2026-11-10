import { PDFDocument, PDFFont, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { ddmmyyyy, headerMonths, monthTitle, parts, periodColumns } from './dates'
import { statusColor } from './statusCodes'
import { key, type Marks, type RosterEntry } from './types'

// Geometry measured from reference/MUSTER-2026-1.pdf. PDF space, origin bottom-left, points.
const PAGE = [1190.52, 841.92] as const
const V = {
  identity: [30.4, 58.2, 215.7, 255.7],
  dayBlockStart: 336.7,
  days16to31: [362.9, 389.0, 415.1, 441.2, 467.3, 493.4, 519.5, 545.7, 571.9, 598.0, 624.2, 650.4, 676.5, 702.7, 728.8],
  heavyDivider: 755.6,
  days01to15: [782.2, 808.4, 834.4, 860.6, 886.8, 912.9, 939.1, 965.3, 991.4, 1017.6, 1043.7, 1069.9, 1096.1, 1122.2],
  rightEdge: 1147.2,
}
const H = {
  tableTop: 756.2,
  belowHeaderBand: 725.7,
  belowDayNumbers: 702.4,
  belowEachRow: [672.0, 641.5, 611.0, 580.5, 549.9, 519.4, 488.9, 458.5, 428.0, 397.5, 366.9, 336.4, 305.9, 275.4, 244.9, 214.5, 183.8],
}
const RULE = 0.48
const HEAVY = 1.44
const H_LEFT = 30.4
const H_RIGHT = 1147.68
const GREY = rgb(0.85, 0.85, 0.85)
const BLACK = rgb(0, 0, 0)

const DECLARATION =
  'All the Employees were physically present while on duty at ENNORE Station, and all leave has been sanctioned through HRMS for the above said period.'

export const FONT_FILES = {
  calibri: 'Carlito-Regular.ttf',
  calibriBold: 'Carlito-Bold.ttf',
  calibriBoldItalic: 'Carlito-BoldItalic.ttf',
  narrowBold: 'LiberationSansNarrow-Bold.ttf',
  bookmanBold: 'texgyrebonum-bold.otf',
  clarendonBold: 'Besley-Bold.ttf',
  arialBlack: 'ArchivoBlack-Regular.ttf',
  // Absentees statement only
  calibriItalic: 'Carlito-Italic.ttf',
  arial: 'LiberationSans-Regular.ttf',
  arialBold: 'LiberationSans-Bold.ttf',
} as const
export type FontKey = keyof typeof FONT_FILES
export type FontBytes = Partial<Record<FontKey, ArrayBuffer | Uint8Array>>
export type Fonts = Record<FontKey, PDFFont>

export const MUSTER_FONTS: FontKey[] = ['calibri', 'calibriBold', 'calibriBoldItalic', 'narrowBold', 'bookmanBold', 'clarendonBold', 'arialBlack']

// Each font file is fetched once per app session (and the browser caches it for good).
const fetched = new Map<FontKey, Promise<ArrayBuffer>>()
export async function loadFontsBrowser(keys: FontKey[], base = '/fonts/'): Promise<FontBytes> {
  const entries = await Promise.all(keys.map(async (k) => {
    let p = fetched.get(k)
    if (!p) {
      p = fetch(base + FONT_FILES[k]).then((r) => { if (!r.ok) throw new Error('font ' + k); return r.arrayBuffer() })
      p.catch(() => fetched.delete(k))
      fetched.set(k, p)
    }
    return [k, await p] as const
  }))
  return Object.fromEntries(entries)
}

/** Embeds only the fonts a document uses. */
export async function embedFonts(doc: PDFDocument, bytes: FontBytes, keys: FontKey[]): Promise<Fonts> {
  doc.registerFontkit(fontkit)
  const f = {} as Fonts
  for (const k of keys) {
    const b = bytes[k]
    if (!b) throw new Error('Missing font ' + k)
    // pdf-lib's subsetter drops glyphs from Carlito and the OTF Bookman substitute, so those embed whole.
    const whole = k === 'bookmanBold' || k.startsWith('calibri')
    // Ligatures (Carlito's "ti") break pdf-lib's spacing, so they are off.
    f[k] = await doc.embedFont(b, { subset: !whole, features: { liga: false, clig: false, dlig: false, calt: false } })
  }
  return f
}

export function rgbHex(c: string) {
  const n = parseInt(c.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export interface MusterInput {
  periodStart: string
  roster: RosterEntry[]
  marks: Marks
  remarks: string
  /** Interim PDF only: cells after this date print blank and a banner is added. */
  asOf?: string
  fonts: FontBytes
}

const hex = rgbHex

export async function buildMusterPdf(input: MusterInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const f = await embedFonts(doc, input.fonts, MUSTER_FONTS)
  doc.setTitle(`Muster Roll ENNORE ${monthTitle(input.periodStart)}`)
  const page = doc.addPage([...PAGE])

  const text = (s: string, x: number, y: number, font: PDFFont, size: number, color = BLACK) =>
    page.drawText(s, { x, y, font, size, color })
  const centred = (s: string, l: number, r: number, y: number, font: PDFFont, size: number, color = BLACK) =>
    text(s, (l + r) / 2 - font.widthOfTextAtSize(s, size) / 2, y, font, size, color)

  // Column bounds
  const idCols: [number, number][] = [
    [V.identity[0], V.identity[1]],
    [V.identity[1], V.identity[2]],
    [V.identity[2], V.identity[3]],
    [V.identity[3], V.dayBlockStart],
  ]
  const dayLefts = [V.dayBlockStart, ...V.days16to31, V.heavyDivider, ...V.days01to15]
  const dayCols = dayLefts.map((l, i): [number, number] => [l, dayLefts[i + 1] ?? V.rightEdge])
  const columns = periodColumns(input.periodStart)

  // Rows: roster + one numbered spare row. Over 17 rows, shrink evenly to end at the same line.
  const nRows = input.roster.length + 1
  const rowTops: number[] = [H.belowDayNumbers]
  if (nRows === 17) rowTops.push(...H.belowEachRow)
  else {
    const h = nRows > 17 ? (H.belowDayNumbers - H.belowEachRow[16]) / nRows : H.belowDayNumbers - H.belowEachRow[0]
    for (let i = 1; i <= nRows; i++) rowTops.push(H.belowDayNumbers - h * i)
  }
  const tableBottom = rowTops[nRows] - RULE
  const rowH = (i: number) => rowTops[i] - rowTops[i + 1]
  // Text offsets in the reference are for a 30.5 pt row; scale them for shorter rows.
  const off = (i: number, v: number) => (v * rowH(i)) / 30.5

  // 1. Grey no-such-date cells, beneath the rules
  columns.forEach((c, ci) => {
    if (c.date) return
    const [l, r] = dayCols[ci]
    page.drawRectangle({ x: l, y: tableBottom, width: r - l, height: rowTops[0] - tableBottom, color: GREY })
  })

  // 2. Rules
  const vline = (x: number, top: number, w = RULE) =>
    page.drawRectangle({ x, y: tableBottom, width: w, height: top - tableBottom, color: BLACK })
  const hline = (top: number) =>
    page.drawRectangle({ x: H_LEFT, y: top - RULE, width: H_RIGHT - H_LEFT, height: RULE, color: BLACK })
  const tall = new Set([V.identity[0], V.dayBlockStart, V.heavyDivider, V.rightEdge])
  for (const x of [...V.identity, V.dayBlockStart, ...V.days16to31, ...V.days01to15, V.rightEdge]) {
    vline(x, tall.has(x) ? H.tableTop : H.belowHeaderBand)
  }
  vline(V.heavyDivider, H.tableTop, HEAVY)
  for (const y of [H.tableTop, H.belowHeaderBand, ...rowTops]) hline(y)

  // 3. Title
  const TY = 770.8
  text('Muster Roll of', 36.0, TY, f.calibri, 16)
  text('ENNORE Station', 131.9, TY, f.calibriBold, 18)
  text('Staffs', 257.3, TY, f.calibriBold, 16)
  text('for the Month of', 298.3, TY, f.calibri, 16)
  text(monthTitle(input.periodStart), 411.2, TY, f.calibriBold, 16)
  if (input.asOf) {
    const s = `INTERIM: recorded up to ${ddmmyyyy(input.asOf)}`
    text(s, V.rightEdge - f.calibriBold.widthOfTextAtSize(s, 12), TY, f.calibriBold, 12)
  }

  // 4. Header band and column headings
  const [m1, m2] = headerMonths(input.periodStart)
  centred(m1, V.dayBlockStart, V.heavyDivider, 731.7, f.calibriBold, 12)
  centred(m2, V.heavyDivider, V.rightEdge, 731.7, f.calibriBold, 12)
  text('Sl.', 36.0, 709.8, f.narrowBold, 11)
  text('NAME', 63.8, 709.1, f.arialBlack, 12)
  centred('Des.', ...idCols[2], 709.4, f.arialBlack, 11)
  centred('PF / HRMS', ...idCols[3], 709.4, f.arialBlack, 11)
  columns.forEach((c, ci) => centred(c.label, ...dayCols[ci], 709.9, f.clarendonBold, 11))

  // 5. Rows
  const asOf = input.asOf
  for (let i = 0; i < nRows; i++) {
    const top = rowTops[i]
    const y = top - off(i, 19.7)
    text(`${i + 1}.`, 36.0, y, f.narrowBold, 12)
    const r = input.roster[i]
    if (!r) continue
    text(r.full_name, 63.8, y, f.narrowBold, 12)
    centred(r.designation, ...idCols[2], y, f.narrowBold, 12)
    centred(r.pf_hrms_number, ...idCols[3], top - off(i, 13.9), f.narrowBold, 12)
    centred(r.code, ...idCols[3], top - off(i, 25.9), f.bookmanBold, 10)
    columns.forEach((c, ci) => {
      if (!c.date || (asOf && c.date > asOf)) return
      const s = input.marks[key(r.employee_id, c.date)]
      if (!s) return
      // Long leave codes (e.g. CCLSF) shrink to fit the cell; nudged up to stay visually centred.
      const [l, r2] = dayCols[ci]
      const size = Math.min(12, (r2 - l - 2) / f.narrowBold.widthOfTextAtSize(s, 1))
      centred(s, l, r2, y + (12 - size) * 0.35, f.narrowBold, size, hex(statusColor(s)))
    })
  }

  // 6. Declaration and remarks
  text(DECLARATION, 36.0, 147.6, f.calibriBoldItalic, 14)
  text('Remarks :', 36.0, 94.7, f.calibriBoldItalic, 14)
  wrap(input.remarks.trim(), f.calibri, 12, V.rightEdge - 97)
    .slice(0, 2)
    .forEach((line, li) => text(line, 97, 94.7 - li * 15, f.calibri, 12))

  return doc.save()
}

function wrap(s: string, font: PDFFont, size: number, width: number): string[] {
  if (!s) return []
  const lines: string[] = []
  for (const para of s.split(/\r?\n/)) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= width) line = next
      else {
        if (line) lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

export function musterFileName(periodStart: string, asOf?: string): string {
  const [y, m] = parts(periodStart)
  const base = `Muster-ENNORE-${y}-${String(m).padStart(2, '0')}`
  return asOf ? `${base}-Interim-${asOf}.pdf` : `${base}-Final.pdf`
}
