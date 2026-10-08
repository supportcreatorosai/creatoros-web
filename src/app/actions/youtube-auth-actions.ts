"use server"

import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export async function connectYouTubeAction() {
  const { data: { user }, error: authError } = await getCustomUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  const supabase = await createClient();
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'; // Or use vercel url
  
  // We specify the YouTube upload scope
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/youtube.upload',
      redirectTo: `${siteUrl}/auth/youtube/callback`,
      queryParams: {
        access_type: 'offline', // Request a refresh token
        prompt: 'consent',      // Force consent to get refresh token
      }
    }
  });

  if (error) {
    console.error("Error initiating YouTube OAuth:", error);
    return { success: false, error: "Failed to initiate connection." };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { success: false, error: "No redirect URL generated." };
}

export async function checkYouTubeConnectionAction() {
  const { data: { user }, error: authError } = await getCustomUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('youtube_connections')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return { success: true, connected: false };
  }

  return { success: true, connected: true };
}
