/**
 * HRMS audit trail (requirement doc §29).
 *
 * Every approval, override and unlock is written here with who did it, what
 * changed and why. Best-effort by design: a logging failure must never block
 * the action a manager just took, but it is reported to the server console.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditEntity =
  | 'attendance' | 'leave_request' | 'regularization' | 'late_permission'
  | 'payroll' | 'employee' | 'settings'

export interface AuditEntry {
  entity: AuditEntity
  entityId?: string | null
  action: string
  oldValue?: unknown
  newValue?: unknown
  reason?: string | null
  changedBy?: string | null
  changedByName?: string | null
}

export async function writeAudit(
  db: SupabaseClient<any, any, any>,
  entry: AuditEntry,
): Promise<void> {
  try {
    await db.from('hrms_audit_logs').insert({
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      action: entry.action,
      old_value: (entry.oldValue ?? null) as never,
      new_value: (entry.newValue ?? null) as never,
      reason: entry.reason ?? null,
      changed_by: entry.changedBy ?? null,
      changed_by_name: entry.changedByName ?? null,
    } as never)
  } catch (e) {
    console.error('hrms audit log failed:', e)
  }
}
