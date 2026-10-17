"use server"

import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createYouTubeOAuthClient, YOUTUBE_STATE_COOKIE } from "@/lib/youtube/oauth";
import { enforceRateLimit, RateLimitError, RateLimitUnavailableError } from "@/lib/security/rate-limit";

export async function connectYouTubeAction() {
  const { data: { user }, error: authError } = await getCustomUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  const supabase = await createClient();
  
  let url: string;
  try {
    await enforceRateLimit(supabase, "youtube-connect", 10, 3600);
    const client = createYouTubeOAuthClient();
    const state = randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(YOUTUBE_STATE_COOKIE, JSON.stringify({ state, userId: user.id }), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/auth/youtube/callback",
    });
    url = client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/youtube.upload"], state, login_hint: user.email });
  } catch (error) {
    return { success: false, error: error instanceof RateLimitError || error instanceof RateLimitUnavailableError ? error.message : "YouTube connection is not configured. Please contact support." };
  }
  redirect(url);
}

export async function checkYouTubeConnectionAction() {
  const { data: { user }, error: authError } = await getCustomUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('youtube_connections')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return { success: true, connected: false };
  }

  return { success: true, connected: true };
}
