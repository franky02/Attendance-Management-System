export interface Employee {
  id: string
  full_name: string
  designation: string
  pf_hrms_number: string
  code: string
  display_order: number
  left_on: string | null
  station?: string
}

export interface RosterEntry {
  employee_id: string
  serial: number
  full_name: string
  designation: string
  pf_hrms_number: string
  code: string
}

export interface PeriodRow {
  start_date: string
  end_date: string
  roster: RosterEntry[]
  remarks: string
  final_downloaded_at: string | null
  station?: string
}

export interface NightDutyRow {
  period_start: string
  employee_id: string
  roster: string
  hours: number | null
  remarks: string
  updated_at?: string
}

export interface Holiday {
  holiday_date: string
  name: string
}

export interface AttendanceRow {
  employee_id: string
  att_date: string
  status: string
  updated_at?: string
}

/** Attendance keyed by `${employee_id}|${att_date}`. A missing key is a blank cell. */
export type Marks = Record<string, string>

export const key = (employeeId: string, date: string) => `${employeeId}|${date}`
