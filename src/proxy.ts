import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { securityHeaders } from '@/lib/security/headers'

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const headers = securityHeaders(nonce, process.env.NODE_ENV !== 'production', process.env.NEXT_PUBLIC_SUPABASE_URL)
  request.headers.set('x-nonce', nonce)
  request.headers.set('Content-Security-Policy', headers['Content-Security-Policy'])
  const response = await updateSession(request)
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
