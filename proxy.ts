import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isBbRole } from '@/lib/bb/constants'
import { withBase } from '@/lib/base-path'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const { pathname } = request.nextUrl

  // Routes that never use the visitor's session are let through before any
  // Supabase call. getUser() is a network round trip to Supabase Auth, and it
  // used to run first — so every API call, every webhook (biometric punches,
  // the WhatsApp bot, Meta, IVR) and every public link paid for a session
  // lookup whose answer was then ignored. API routes authenticate themselves
  // (and can refresh their own cookies); public pages need no session.
  const isApiRoute    = pathname.startsWith('/api')
  // Public short links (invoice PDFs shared on WhatsApp) + public lead-capture
  // forms (Meta ads landing pages at /f/{slug}) + Review QR pages customers
  // reach by scanning (/r/{slug}) + walk-in registration page
  const isPublicLink  = pathname.startsWith('/i/') || pathname.startsWith('/f/') || pathname.startsWith('/r/')
  const isWalkinRoute = pathname === '/walkin'
  // Public associate registration link shared on WhatsApp
  const isJoinRoute   = pathname === '/join'
  // PWA install assets. These were being redirected to /login, so "Add to Home
  // Screen" never picked up the app name or icons.
  const isPwaAsset    = pathname === '/manifest.webmanifest' || pathname === '/sw.js'

  if (isApiRoute || isPublicLink || isPwaAsset || isWalkinRoute || isJoinRoute) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser(), not getClaims(): on Vercel getClaims() hung until the proxy
  // hit MIDDLEWARE_INVOCATION_TIMEOUT (504) on every page, login included.
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  const isStudentRoute   = pathname.startsWith('/student/') && pathname !== '/student/login'
  const isStudentLogin   = pathname === '/student/login'
  const isAdminLogin     = pathname === '/login'
  const isAssociateRoute = pathname.startsWith('/associate')
  // Berojgar Bharat — a separate business in the same app. Its staff never see
  // the DCW side and DCW staff never see theirs; both directions are enforced
  // here rather than trusted to the UI.
  const isBbRoute        = pathname.startsWith('/bb')
  const isAdminRoute     = !isStudentRoute && !isAssociateRoute && !isBbRoute && !isAdminLogin && !isStudentLogin

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    let role = profile?.role

    // Fallback: if no profile row, check students table
    if (!role) {
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .eq('portal_user_id', userId)
        .maybeSingle()
      if (studentRecord) role = 'student'
    }

    // Berojgar Bharat staff live entirely inside /bb.
    if (isBbRole(role)) {
      if (!isBbRoute) {
        return NextResponse.redirect(new URL(withBase('/bb/dashboard'), request.url))
      }
      return response
    }
    // Everyone else is refused the BB area outright.
    if (isBbRoute) {
      if (role === 'student')   return NextResponse.redirect(new URL(withBase('/student/dashboard'), request.url))
      if (role === 'associate') return NextResponse.redirect(new URL(withBase('/associate'), request.url))
      return NextResponse.redirect(new URL(withBase('/dashboard'), request.url))
    }

    // Student → always go to student portal
    if (role === 'student' && !isStudentRoute && !isStudentLogin) {
      return NextResponse.redirect(new URL(withBase('/student/dashboard'), request.url))
    }
    if (role !== 'student' && isStudentRoute) {
      return NextResponse.redirect(new URL(withBase(role === 'associate' ? '/associate' : '/dashboard'), request.url))
    }

    // Associate → always go to /associate, never admin area
    if (role === 'associate' && isAdminRoute) {
      return NextResponse.redirect(new URL(withBase('/associate'), request.url))
    }

    // Bounce logged-in users off login pages
    if (isAdminLogin) {
      if (role === 'student')   return NextResponse.redirect(new URL(withBase('/student/dashboard'), request.url))
      if (role === 'associate') return NextResponse.redirect(new URL(withBase('/associate'), request.url))
      return NextResponse.redirect(new URL(withBase('/dashboard'), request.url))
    }
    if (isStudentLogin && role === 'student') {
      return NextResponse.redirect(new URL(withBase('/student/dashboard'), request.url))
    }
  } else {
    // Unauthenticated
    if (isStudentRoute) {
      return NextResponse.redirect(new URL(withBase('/student/login'), request.url))
    }
    if (!isAdminLogin && !isStudentLogin && !isAssociateRoute && !isWalkinRoute) {
      return NextResponse.redirect(new URL(withBase('/login'), request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.ico$).*)',
  ],
}
