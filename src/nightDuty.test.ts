import { describe, expect, it } from 'vitest'
import { fmtNumber, fmtWeighted, parseHours } from './nightDuty'

describe('night duty', () => {
  it('weighted hours are hours ÷ 6, 2 decimals unless whole', () => {
    expect(fmtWeighted(48)).toBe('8')
    expect(fmtWeighted(50)).toBe('8.33')
    expect(fmtWeighted(51)).toBe('8.50')
    expect(fmtWeighted(0)).toBe('0')
    expect(fmtWeighted(null)).toBe('')
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
