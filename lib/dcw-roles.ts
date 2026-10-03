/**
 * Roles of DCW's own staff. Use this (an allow-list) when listing people to
 * pick from — counsellor, assignee, host — so Berojgar Bharat logins (bb_*),
 * students and associates never show up in DCW dropdowns, even though they
 * share the profiles table.
 */
export const DCW_STAFF_ROLES: string[] = ['admin', 'backend', 'lead', 'telecaller', 'counselor', 'finance', 'housekeeping']
