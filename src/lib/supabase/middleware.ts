import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeRedirectPath } from '@/lib/security/validation'
import { hasVerifiedEmail } from '@/lib/auth/validation'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isProtectedRoute = ['/dashboard', '/settings'].some(path => pathname === path || pathname.startsWith(path + '/'))
  const verified = hasVerifiedEmail(user)

  function redirectWithCookies(path: string) {
    const response = NextResponse.redirect(new URL(path, request.url))
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }
  if (isProtectedRoute && !verified) {
    const query = new URLSearchParams({ redirectTo: safeRedirectPath(pathname + request.nextUrl.search) })
    if (user?.email) query.set('email', user.email)
    return redirectWithCookies((user ? '/otp-verify?' : '/login?') + query)
  }
  if (verified && isAuthPage) return redirectWithCookies(safeRedirectPath(request.nextUrl.searchParams.get('redirectTo')))
  if (user) supabaseResponse.headers.set('Cache-Control', 'private, no-store')
  return supabaseResponse
}
