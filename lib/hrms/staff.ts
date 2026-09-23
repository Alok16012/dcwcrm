/**
 * Associates and students have their own modules — they are never HRMS
 * employees, even if an `employees` row exists for their profile. Every HRMS
 * list (attendance, leave, payroll, advances, regularization, biometric)
 * filters through here so one stray row can't reappear across the module.
 */
export const NON_EMPLOYEE_ROLES = new Set(['associate', 'student'])

export const isStaffRole = (role: string | null | undefined) =>
  !!role && !NON_EMPLOYEE_ROLES.has(role)

/** Keeps only the employee rows whose profile is internal staff. */
export function onlyStaff<T extends { profile_id: string }>(
  rows: T[],
  profileRole: Record<string, string | undefined>,
): T[] {
  return rows.filter(r => isStaffRole(profileRole[r.profile_id]))
}
