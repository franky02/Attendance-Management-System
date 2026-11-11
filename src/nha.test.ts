import { describe, expect, it } from 'vitest'
import { nhaCount, nhaRows, nhRemark, nhResult } from './nha'

const roster = [1, 2, 3, 4].map((i) => ({ employee_id: `e${i}`, serial: i, full_name: `N${i}`, designation: 'SS', pf_hrms_number: '', code: '' }))

describe('NHA eligibility', () => {
  it('P, Rest and CR are eligible; NH availed, A and other leave are not; blank is not marked', () => {
    for (const c of ['P', 'R', 'CR']) expect(nhResult(c)).toBe('eligible')
    for (const c of ['NH', 'A', 'LAP', 'CL', 'S', 'RH']) expect(nhResult(c)).toBe('ineligible')
    expect(nhResult(undefined)).toBe('unmarked')
  })
  it('counts eligible NH days per person across several NHs (January example)', () => {
    const dates = ['2026-01-01', '2026-01-15', '2026-01-26']
    const marks = {
      'e1|2026-01-01': 'P', 'e1|2026-01-15': 'P', 'e1|2026-01-26': 'P',
      'e2|2026-01-01': 'P', 'e2|2026-01-15': 'NH', 'e2|2026-01-26': 'CR',
      'e3|2026-01-01': 'R', 'e3|2026-01-15': 'LAP', 'e3|2026-01-26': 'A',
      'e4|2026-01-01': 'P',
    }
    const rows = nhaRows(dates, roster, marks)
    expect(rows.map((r) => r.count)).toEqual([3, 2, 1, 1])
    expect(rows[3].results.map((r) => r.result)).toEqual(['eligible', 'unmarked', 'unmarked'])
  })
  it('remarks and count text', () => {
    expect(nhRemark('P')).toBe('Present')
    expect(nhRemark('NH')).toBe('NH Availed')
    expect(nhRemark('LAP')).toBe('LAP')
    expect(nhRemark(undefined)).toBe('Not marked')
    expect(nhaCount(3)).toBe('03')
    expect(nhaCount(0)).toBe('--')
  })
})
