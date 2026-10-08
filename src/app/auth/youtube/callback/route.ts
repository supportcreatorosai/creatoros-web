import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCustomUser } from '@/lib/auth/session';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');

  // Supabase returns a # access_token for implicit flow, but since we use server-side OAuth flow (PKCE), it returns a `code` query param.
  
  if (error) {
    console.error("OAuth Error:", error);
    return NextResponse.redirect(`${requestUrl.origin}/dashboard/youtube-generator?error=oauth_rejected`);
  }

  if (code) {
    const supabase = await createClient();
    
    // Exchange the code for a session
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (sessionError || !session) {
      console.error("Session exchange error:", sessionError);
      return NextResponse.redirect(`${requestUrl.origin}/dashboard/youtube-generator?error=session_error`);
    }

    // Now we have the session from Supabase Auth.
    // It contains the Google provider tokens.
    const googleAccessToken = session.provider_token;
    const googleRefreshToken = session.provider_refresh_token;

    // Get our custom user session to link it
    const { data: { user: customUser } } = await getCustomUser();

    if (customUser && googleAccessToken) {
      // Upsert the tokens into youtube_connections
      const { error: upsertError } = await supabase
        .from('youtube_connections')
        .upsert({
          user_id: customUser.id,
          google_access_token: googleAccessToken,
          google_refresh_token: googleRefreshToken || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
        
      if (upsertError) {
        console.error("Error saving youtube connection:", upsertError);
        return NextResponse.redirect(`${requestUrl.origin}/dashboard/youtube-generator?error=db_error`);
      }
      
      // Redirect back to generator
      return NextResponse.redirect(`${requestUrl.origin}/dashboard/youtube-generator?success=connected`);
    }
  }

  // Fallback
  return NextResponse.redirect(`${requestUrl.origin}/dashboard/youtube-generator`);
}
