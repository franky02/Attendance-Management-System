import { describe, expect, it } from 'vitest'
import {
  addDays, headerMonths, monthTitle, shortMonthTitle, periodColumns, periodDates, periodFor, periodLabel, shiftPeriod, todayIST,
} from './dates'

describe('periodFor', () => {
  it.each([
    ['2026-11-09', '2026-10-16', '2026-11-15', 31],
    ['2026-11-16', '2026-11-16', '2026-12-15', 30],
    ['2027-01-15', '2026-12-16', '2027-01-15', 31],
    ['2027-02-20', '2027-02-16', '2027-03-15', 28],
    ['2028-03-01', '2028-02-16', '2028-03-15', 29],
  ])('%s → %s to %s (%i days)', (input, start, end, days) => {
    const p = periodFor(input)
    expect(p).toEqual({ start, end })
    expect(periodDates(p.start)).toHaveLength(days)
    expect(periodDates(p.start).at(-1)).toBe(end)
  })
})

describe('periodColumns', () => {
  it('always has 31 columns 16…31 then 01…15', () => {
    const cols = periodColumns('2027-02-16')
    expect(cols).toHaveLength(31)
    expect(cols.map((c) => c.label).join(' ')).toBe(
      '16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15',
    )
    expect(cols[12]).toEqual({ label: '28', date: '2027-02-28' })
    expect(cols[13].date).toBeNull()
    expect(cols[15].date).toBeNull()
    expect(cols[16]).toEqual({ label: '01', date: '2027-03-01' })
  })
  it('leap February keeps the 29th', () => {
    expect(periodColumns('2028-02-16')[13].date).toBe('2028-02-29')
  })
})

describe('labels', () => {
  it('same year', () => {
    expect(monthTitle('2026-10-16')).toBe('OCTOBER - NOVEMBER 2026')
    expect(headerMonths('2026-10-16')).toEqual(['OCTOBER 2026', 'NOVEMBER 2026'])
    expect(periodLabel('2026-10-16')).toBe('16 Oct to 15 Nov 2026')
  })
  it('across a year', () => {
    expect(monthTitle('2026-12-16')).toBe('DECEMBER 2026 - JANUARY 2027')
    expect(headerMonths('2026-12-16')).toEqual(['DECEMBER 2026', 'JANUARY 2027'])
    expect(periodLabel('2026-12-16')).toBe('16 Dec 2026 to 15 Jan 2027')
    expect(shortMonthTitle('2026-10-16')).toBe('OCT - NOV 2026')
    expect(shortMonthTitle('2026-12-16')).toBe('DEC 2026 - JAN 2027')
  })
})

describe('helpers', () => {
  it('addDays crosses months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })
  it('shiftPeriod', () => {
    expect(shiftPeriod('2026-12-16', 1)).toBe('2027-01-16')
    expect(shiftPeriod('2027-01-16', -1)).toBe('2026-12-16')
  })
  it('todayIST uses Kolkata time', () => {
    // 20:00 UTC on 9 Nov is 01:30 on 10 Nov in India
    expect(todayIST(new Date('2026-11-09T20:00:00Z'))).toBe('2026-11-10')
    expect(todayIST(new Date('2026-11-09T18:00:00Z'))).toBe('2026-11-09')
  })
})
