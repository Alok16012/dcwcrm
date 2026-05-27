import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
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

  const isStudentRoute = pathname.startsWith('/student/') && pathname !== '/student/login'
  const isStudentLogin = pathname === '/student/login'
  const isAdminLogin = pathname === '/login'
  const isApiRoute = pathname.startsWith('/api')
  const isAssociateRoute = pathname.startsWith('/associate')

  if (isApiRoute) return response

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    let role = profile?.role

    // Fallback: if no profile row exists, check if this user is linked to a student record
    // This handles students whose profile upsert failed during credential creation
    if (!role) {
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .eq('portal_user_id', user.id)
        .maybeSingle()
      if (studentRecord) {
        role = 'student'
      }
    }

    // Student trying to hit CRM routes — send to student portal
    if (role === 'student' && !isStudentRoute && !isStudentLogin) {
      return NextResponse.redirect(new URL('/student/dashboard', request.url))
    }
    // Non-student trying to access student portal routes
    if (role !== 'student' && isStudentRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    // Bounce logged-in users off login pages
    if (isAdminLogin && role !== 'student') {
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
