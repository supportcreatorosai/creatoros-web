import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/security/validation'
import { recordTermsAcceptance } from '@/lib/auth/terms'
import { hasVerifiedEmail, TERMS_PENDING_COOKIE, TERMS_VERSION } from '@/lib/auth/validation'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = safeRedirectPath(searchParams.get('next'))
  const supabase = await createClient()
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && (type === 'email' || type === 'signup')
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
      : null

  const cookieStore = await cookies()
  const accepted = cookieStore.get(TERMS_PENDING_COOKIE)?.value === TERMS_VERSION
  cookieStore.set(TERMS_PENDING_COOKIE, '', { path: '/auth/callback', maxAge: 0 })
  let target = '/login?error=AuthError'
  if (result && !result.error) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user && hasVerifiedEmail(user)) {
      const google = user.app_metadata?.provider === 'google'
      const existingConsent = google && !accepted
        ? await supabase.from('terms_acceptances').select('terms_version').eq('user_id', user.id).eq('terms_version', TERMS_VERSION).maybeSingle()
        : null
      if (google && !accepted && !existingConsent?.data) {
        await supabase.auth.signOut()
        target = '/register?error=TermsRequired'
      } else if (await recordTermsAcceptance(supabase, user, accepted)) target = next
      else {
        await supabase.auth.signOut()
        target = '/login?error=TermsUnavailable'
      }
    } else {
      const query = new URLSearchParams({ redirectTo: next })
      if (user?.email) query.set('email', user.email)
      target = '/otp-verify?' + query
    }
  }
  const response = NextResponse.redirect(new URL(target, origin))
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
