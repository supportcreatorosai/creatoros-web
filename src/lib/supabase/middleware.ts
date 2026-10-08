import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/settings')

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const originalUrl = `${pathname}${request.nextUrl.search}`
    if (originalUrl !== '/dashboard') {
      url.searchParams.set('redirectTo', originalUrl)
    }
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    url.pathname = redirectTo || '/dashboard'
    url.searchParams.delete('redirectTo')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
