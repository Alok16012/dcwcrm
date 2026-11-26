import type { SupabaseClient, User, UserResponse } from '@supabase/supabase-js'

/**
 * Make `auth.getUser()` check the session locally instead of calling Supabase
 * Auth on every request.
 *
 * getUser() is a network round trip to Supabase Auth. The proxy, the dashboard
 * layout, the page, and every API route each made one, so every click waited
 * for several of them in a row. All of that load landed on one Auth server,
 * and when that server stalled (Nov 2026) every page hung for minutes.
 *
 * This project signs its session tokens with an asymmetric key (ES256), so
 * getClaims() can verify a token's signature on the server with Supabase's
 * public key. auth-js caches that key for 10 minutes across requests, so a
 * check usually costs no network call at all. A legacy HS256 token can't be
 * checked this way, and getClaims() then calls getUser() itself, so the
 * answer is never less trustworthy than before.
 *
 * Patching getUser() covers the 140-odd call sites in one place. getUser(jwt)
 * with an explicit token still goes to Supabase Auth. The trade-off: a token
 * stays valid until it expires (an hour at most) even if the session was
 * revoked. Code that needs to refuse a deactivated user already checks
 * profiles.is_active.
 */
const patched = new WeakSet<object>()

export function verifySessionLocally<C extends SupabaseClient<any, any, any>>(client: C): C {
  const auth = client.auth
  // The browser client is a singleton that createClient() hands back on every
  // render, so patch it once rather than wrapping it again each time.
  if (patched.has(auth)) return client
  patched.add(auth)
  const remoteGetUser = auth.getUser.bind(auth)

  auth.getUser = (async (jwt?: string): Promise<UserResponse> => {
    if (jwt) return remoteGetUser(jwt)

    const { data, error } = await auth.getClaims()
    if (error || !data?.claims?.sub) {
      return { data: { user: null }, error: error ?? null } as UserResponse
    }

    const c = data.claims as Record<string, any>
    const user = {
      id: c.sub,
      aud: c.aud,
      role: c.role,
      email: c.email,
      phone: c.phone,
      app_metadata: c.app_metadata ?? {},
      user_metadata: c.user_metadata ?? {},
      is_anonymous: c.is_anonymous ?? false,
      created_at: '',
    } as User

    return { data: { user }, error: null }
  }) as typeof auth.getUser

  return client
}
