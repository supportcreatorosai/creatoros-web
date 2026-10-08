import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Check if user has already verified OTP
        const otpVerified = user.user_metadata?.otp_verified
        
        if (!otpVerified) {
          // Generate OTP for new Google user or unverified user
          const otp = Math.floor(100000 + Math.random() * 900000).toString()
          
          await supabase.auth.updateUser({
            data: {
              otp: otp,
              otp_verified: false,
              is_first_login: user.user_metadata?.is_first_login !== false // If not explicitly false, it's true
            }
          })
          
          return NextResponse.redirect(`${origin}/otp-verify`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=AuthError`)
}
