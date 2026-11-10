/* eslint-disable @typescript-eslint/no-explicit-any */

// Scoping WhatsApp bot queries to one number (wa_accounts, migration 126).
// Before that migration there is a single number and no account_id column,
// so a null accountId keeps the old queries.

/** One number's rows. */
export function byAccount(q: any, accountId: string | null) {
  return accountId ? q.eq('account_id', accountId) : q
}

/** One number's settings row — the single row with id = true before migration 126. */
export function bySettings(q: any, accountId: string | null) {
  return accountId ? q.eq('account_id', accountId) : q.eq('id', true)
}
