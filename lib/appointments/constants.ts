import { addMinutes, format, getDay, parse } from 'date-fns'

// Single source of truth for the appointments feature's business rules.
// Kept here (not scattered per-component) because these numbers are also
// mirrored in the migration's RLS comments — if you change HOST_ROLES,
// the appointments_select/insert policies in
// supabase/migrations/100_appointments.sql need a matching update.

export const HOST_ROLES = ['admin', 'lead', 'counselor'] as const

export const BUSINESS_HOURS_START = '10:00'
export const BUSINESS_HOURS_END = '18:00'
export const SLOT_DURATION_MINUTES = 30

// date-fns getDay(): 0 = Sunday.
export function isWorkingDay(date: Date): boolean {
  return getDay(date) !== 0
}

// Every bookable slot start time for one day, e.g. ['10:00', '10:30', ..., '17:30'].
// The last slot starts far enough before closing time to fit its full duration.
export function generateDaySlots(): string[] {
  const slots: string[] = []
  const dayStart = parse(BUSINESS_HOURS_START, 'HH:mm', new Date())
  const dayEnd = parse(BUSINESS_HOURS_END, 'HH:mm', new Date())
  let cursor = dayStart
  while (addMinutes(cursor, SLOT_DURATION_MINUTES) <= dayEnd) {
    slots.push(format(cursor, 'HH:mm'))
    cursor = addMinutes(cursor, SLOT_DURATION_MINUTES)
  }
  return slots
}
