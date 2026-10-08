import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const url = new URL(request.url)
  const response = NextResponse.redirect(new URL('/', url.origin), { status: 302 })
  
  // Explicitly delete the custom session cookie on the response
  response.cookies.delete('creatoros_custom_session')
  
  return response
}
