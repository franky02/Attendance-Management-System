// The one list of attendance codes. The Mark screen, Muster grid and PDF all read it.
// To add a leave type, add one line to LEAVE_TYPES.
export type Kind = 'present' | 'absent' | 'rest'

export interface StatusCode {
  code: string
  label: string
  color: string
  kind: Kind
}

const BLUE = '#1565C0'
const RED = '#C62828'

/** Shown when the A button is tapped. Codes as used in HRMS. */
export const LEAVE_TYPES: [code: string, label: string][] = [
  ['CL', 'Casual Leave'],
  ['RH', 'Restricted Holiday'],
  ['LAP', 'Leave on Average Pay'],
  ['LHAP', 'Leave on Half Average Pay'],
  ['CCLSF', 'Child Care Leave for Single Father'],
  ['CALF', 'Child Adoption Leave (Father)'],
  ['COL', 'Commuted Leave'],
  ['EOL', 'Extra Ordinary Leave'],
  ['FPL', 'Family Planning Leave'],
  ['LVHQ', 'HQs Leaving Permission'],
  ['JT', 'Joining Time'],
  ['JTLAP', 'Joining Time added to LAP'],
  ['LND', 'Leave Not Due'],
  ['PL', 'Paternity Leave'],
  ['SCL', 'Special Casual Leave'],
  ['SL', 'Study Leave'],
  ['WRIIL', 'Work Related / Illness and Injury Leave'],
  ['RC', 'Refresher Course'],
  ['CR', 'Compensatory Rest'],
  ['S', 'Sick Leave'],
  ['PME', 'Periodical Medical Examination'],
  ['NH', 'National Holiday availed'],
]

export const STATUS_CODES: StatusCode[] = [
  { code: 'P', label: 'Present', color: BLUE, kind: 'present' },
  { code: 'A', label: 'Absent (no leave type)', color: RED, kind: 'absent' },
  { code: 'R', label: 'Rest', color: RED, kind: 'rest' },
  ...LEAVE_TYPES.map(([code, label]): StatusCode => ({ code, label, color: RED, kind: 'absent' })),
]

/** Absent plus every leave type: the choices behind the A button. */
export const ABSENT_CODES = STATUS_CODES.filter((s) => s.kind === 'absent')

export function statusOf(code: string): StatusCode | undefined {
  return STATUS_CODES.find((s) => s.code === code)
}

/** Unknown codes (e.g. one removed from the list later) still show, in red, as absent. */
export function kindOf(code: string): Kind {
  return statusOf(code)?.kind ?? 'absent'
}

export function statusColor(code: string): string {
  return statusOf(code)?.color ?? RED
}
