import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const url = new URL(request.url)
  if (request.headers.get('origin') !== url.origin) return new Response('Forbidden', { status: 403 })
  const supabase = await createClient()
  await supabase.auth.signOut()
  const response = NextResponse.redirect(new URL('/login', url.origin), { status: 303 })
  response.cookies.delete('creatoros_custom_session')
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
