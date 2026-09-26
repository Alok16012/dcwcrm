/** Berojgar Bharat — shared labels, roles and status vocabulary. */

export const BB_ROLES = ['bb_admin', 'bb_manager', 'bb_telecaller'] as const
export type BbRole = (typeof BB_ROLES)[number]

export const BB_ROLE_LABELS: Record<BbRole, string> = {
  bb_admin: 'Admin',
  bb_manager: 'Manager',
  bb_telecaller: 'Telecaller',
}

/** Roles allowed to see money and manage companies, jobs and placements. */
export const BB_MANAGER_ROLES: string[] = ['bb_admin', 'bb_manager']

export function isBbRole(role: string | null | undefined): boolean {
  return !!role && (BB_ROLES as readonly string[]).includes(role)
}

export function isBbManagerRole(role: string | null | undefined): boolean {
  return !!role && BB_MANAGER_ROLES.includes(role)
}

// ------------------------------------------------------------ candidates ---

export const CANDIDATE_STATUSES = [
  'new', 'contacted', 'interested', 'not_interested', 'screening',
  'shortlisted', 'interview_scheduled', 'selected', 'placed', 'joined',
  'dropped', 'blacklisted',
] as const
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number]

export const CANDIDATE_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  new:                 { label: 'New',            cls: 'bg-slate-100 text-slate-700' },
  contacted:           { label: 'Contacted',      cls: 'bg-blue-100 text-blue-700' },
  interested:          { label: 'Interested',     cls: 'bg-cyan-100 text-cyan-700' },
  not_interested:      { label: 'Not Interested', cls: 'bg-gray-100 text-gray-500' },
  screening:           { label: 'Screening',      cls: 'bg-indigo-100 text-indigo-700' },
  shortlisted:         { label: 'Shortlisted',    cls: 'bg-violet-100 text-violet-700' },
  interview_scheduled: { label: 'Interview',      cls: 'bg-amber-100 text-amber-700' },
  selected:            { label: 'Selected',       cls: 'bg-emerald-100 text-emerald-700' },
  placed:              { label: 'Placed',         cls: 'bg-green-100 text-green-700' },
  joined:              { label: 'Joined',         cls: 'bg-green-600 text-white' },
  dropped:             { label: 'Dropped',        cls: 'bg-red-100 text-red-700' },
  blacklisted:         { label: 'Blacklisted',    cls: 'bg-red-600 text-white' },
}

export const CANDIDATE_SOURCES = [
  'website', 'walk_in', 'referral', 'whatsapp', 'phone',
  'social_media', 'job_portal', 'excel_import', 'other',
] as const

// ---------------------------------------------------------- applications ---

/** Pipeline order — the board renders columns in exactly this sequence. */
export const APPLICATION_STAGES = [
  'applied', 'screening', 'shortlisted', 'interview',
  'selected', 'offer_sent', 'joined',
] as const
export type ApplicationStage = (typeof APPLICATION_STAGES)[number]

/** Terminal stages, kept off the board but valid in the data. */
export const APPLICATION_CLOSED_STAGES = ['rejected', 'dropped'] as const

export const STAGE_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  applied:     { label: 'Applied',     cls: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-400' },
  screening:   { label: 'Screening',   cls: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  shortlisted: { label: 'Shortlisted', cls: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  interview:   { label: 'Interview',   cls: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  selected:    { label: 'Selected',    cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  offer_sent:  { label: 'Offer Sent',  cls: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500' },
  joined:      { label: 'Joined',      cls: 'bg-green-600 text-white',       dot: 'bg-green-600' },
  rejected:    { label: 'Rejected',    cls: 'bg-red-100 text-red-700',       dot: 'bg-red-400' },
  dropped:     { label: 'Dropped',     cls: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400' },
}

// -------------------------------------------------------------- invoices ---

export const INVOICE_STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending:        { label: 'Pending',        cls: 'bg-slate-100 text-slate-700' },
  raised:         { label: 'Raised',         cls: 'bg-blue-100 text-blue-700' },
  partially_paid: { label: 'Part Paid',      cls: 'bg-amber-100 text-amber-700' },
  paid:           { label: 'Paid',           cls: 'bg-green-100 text-green-700' },
  written_off:    { label: 'Written Off',    cls: 'bg-gray-100 text-gray-500' },
}

// ----------------------------------------------------------------- money ---

/** Indian-format rupees, no decimals — the only money format used in BB. */
export function inr(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n)) return '₹0'
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

/** 125000 -> "1.25L", 4500000 -> "45L", 12000000 -> "1.2Cr" — for KPI tiles. */
export function inrShort(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n) || n === 0) return '₹0'
  const abs = Math.abs(n)
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(abs >= 1e8 ? 0 : 2)}Cr`
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(abs >= 1e6 ? 0 : 2)}L`
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(0)}k`
  return `₹${Math.round(n)}`
}
