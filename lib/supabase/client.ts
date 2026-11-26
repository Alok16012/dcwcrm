import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'
import { verifySessionLocally } from './local-auth'

export function createClient() {
  // getUser() checks the session locally instead of a round trip from the
  // browser to Supabase Auth before each page can load its data: see local-auth.ts.
  return verifySessionLocally(createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))
}
