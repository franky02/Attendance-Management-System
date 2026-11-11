import { describe, expect, it } from 'vitest'
import { fmtHoursPadded, fmtNumber, fmtWeighted, parseHours } from './nightDuty'

describe('night duty', () => {
  it('weighted hours are hours ÷ 6, as 00.00', () => {
    expect(fmtWeighted(36)).toBe('06.00')
    expect(fmtWeighted(54)).toBe('09.00')
    expect(fmtWeighted(56)).toBe('09.33')
    expect(fmtWeighted(66)).toBe('11.00')
    expect(fmtWeighted(51)).toBe('08.50')
    expect(fmtWeighted(0)).toBe('00.00')
    expect(fmtWeighted(744)).toBe('124.00')
    expect(fmtWeighted(null)).toBe('')
    expect(fmtHoursPadded(18.4166)).toBe('18.42')
  })
  it('parses typed hours', () => {
    expect(parseHours('12')).toBe(12)
    expect(parseHours(' 7.5 ')).toBe(7.5)
    expect(parseHours('')).toBeNull()
    expect(parseHours('abc')).toBeUndefined()
    expect(parseHours('-3')).toBeUndefined()
    expect(parseHours('1000')).toBeUndefined()
  })
  it('prints totals plainly', () => {
    expect(fmtNumber(96)).toBe('96')
    expect(fmtNumber(12.5)).toBe('12.50')
  })
})
