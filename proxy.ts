import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
  const isAdminRoute     = !isStudentRoute && !isAssociateRoute && !isAdminLogin && !isStudentLogin

  if (isApiRoute) return response

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

    // Student → always go to student portal
    if (role === 'student' && !isStudentRoute && !isStudentLogin) {
      return NextResponse.redirect(new URL('/student/dashboard', request.url))
    }
    if (role !== 'student' && isStudentRoute) {
      return NextResponse.redirect(new URL(role === 'associate' ? '/associate' : '/dashboard', request.url))
    }

    // Associate → always go to /associate, never admin area
    if (role === 'associate' && isAdminRoute) {
      return NextResponse.redirect(new URL('/associate', request.url))
    }

    // Bounce logged-in users off login pages
    if (isAdminLogin) {
      if (role === 'student')   return NextResponse.redirect(new URL('/student/dashboard', request.url))
      if (role === 'associate') return NextResponse.redirect(new URL('/associate', request.url))
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (isStudentLogin && role === 'student') {
      return NextResponse.redirect(new URL('/student/dashboard', request.url))
    }
  } else {
    // Unauthenticated
    if (isStudentRoute) {
      return NextResponse.redirect(new URL('/student/login', request.url))
    }
    if (!isAdminLogin && !isStudentLogin && !isAssociateRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.ico$).*)',
  ],
}
