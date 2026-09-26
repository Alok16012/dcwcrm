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

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isStudentRoute   = pathname.startsWith('/student/') && pathname !== '/student/login'
  const isStudentLogin   = pathname === '/student/login'
  const isAdminLogin     = pathname === '/login'
  const isApiRoute       = pathname.startsWith('/api')
  const isAssociateRoute = pathname.startsWith('/associate')
  // Berojgar Bharat — a separate business in the same app. Its staff never see
  // the DCW side and DCW staff never see theirs; both directions are enforced
  // here rather than trusted to the UI.
  const isBbRoute        = pathname.startsWith('/bb')
  // Public short links (invoice PDFs shared on WhatsApp) + public lead-capture
  // forms (Meta ads landing pages at /f/{slug}) + walk-in registration page
  const isPublicLink     = pathname.startsWith('/i/') || pathname.startsWith('/f/')
  const isWalkinRoute    = pathname === '/walkin'
  // Public associate registration link shared on WhatsApp
  const isJoinRoute      = pathname === '/join'
  // PWA install assets. These were being redirected to /login, so "Add to Home
  // Screen" never picked up the app name or icons.
  const isPwaAsset       = pathname === '/manifest.webmanifest' || pathname === '/sw.js'
  const isAdminRoute     = !isStudentRoute && !isAssociateRoute && !isBbRoute && !isAdminLogin && !isStudentLogin && !isPublicLink && !isPwaAsset && !isWalkinRoute && !isJoinRoute

  if (isApiRoute || isPublicLink || isPwaAsset || isWalkinRoute || isJoinRoute) return response

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    let role = profile?.role

    // Fallback: if no profile row, check students table
    if (!role) {
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .eq('portal_user_id', user.id)
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
