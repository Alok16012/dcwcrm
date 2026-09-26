import { createClient } from '@/lib/supabase/client'

/**
 * Loosely-typed Supabase handles for the bb_* tables.
 *
 * types/database.types.ts is generated from the DCW schema and does not know
 * these tables exist. Rather than hand-editing a generated file (which the next
 * regeneration would discard), the Berojgar Bharat pages go through these
 * helpers — the same `as any` escape the rest of the codebase already uses,
 * named once instead of repeated at every call site.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type LooseDb = { from: (table: string) => any; rpc: (fn: string, args?: any) => any }

/** Browser client for client components. */
export function bbClient(): LooseDb {
  return createClient() as unknown as LooseDb
}

/** Narrow an already-created server client (from createServerClient). */
export function asLoose(client: unknown): LooseDb {
  return client as LooseDb
}
