import { DCW_STAFF_ROLES } from '@/lib/dcw-roles'

/**
 * Only DCW's own staff are HRMS employees. Associates, students and the
 * Berojgar Bharat logins (bb_*) can have an `employees` row too — BB runs its
 * own HRMS off the same table — so this is an allow-list, not a deny-list.
 * Every HRMS list (attendance, leave, advances, regularization, biometric)
 * filters through here so one stray row can't reappear across the module.
 */
export const isStaffRole = (role: string | null | undefined) =>
  !!role && DCW_STAFF_ROLES.includes(role)

/** Keeps only the employee rows whose profile is internal staff. */
export function onlyStaff<T extends { profile_id: string }>(
  rows: T[],
  profileRole: Record<string, string | undefined>,
): T[] {
  return rows.filter(r => isStaffRole(profileRole[r.profile_id]))
}
