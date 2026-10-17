import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { createYouTubeOAuthClient, YOUTUBE_STATE_COOKIE } from "@/lib/youtube/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const finish = (result: string) => NextResponse.redirect(new URL(`/dashboard/youtube-generator?${result}`, url.origin));
  const cookieStore = await cookies();
  const savedState = cookieStore.get(YOUTUBE_STATE_COOKIE)?.value;
  cookieStore.delete({ name: YOUTUBE_STATE_COOKIE, path: "/auth/youtube/callback" });
  const { data: { user } } = await getCustomUser();
  if (!user || !savedState) return finish("error=invalid_state");
  try {
    const expected: unknown = JSON.parse(savedState);
    const state = url.searchParams.get("state") || "";
    if (!expected || typeof expected !== "object" || !("state" in expected) || !("userId" in expected)
      || expected.userId !== user.id || typeof expected.state !== "string" || !/^[a-f0-9]{64}$/.test(state)
      || expected.state.length !== state.length || !timingSafeEqual(Buffer.from(expected.state), Buffer.from(state))) return finish("error=invalid_state");
    if (url.searchParams.get("error")) return finish("error=oauth_rejected");
    const code = url.searchParams.get("code");
    if (!code || code.length > 2000) return finish("error=invalid_code");
    const { tokens } = await createYouTubeOAuthClient().getToken(code);
    if (!tokens.access_token) return finish("error=token_error");
    const supabase = await createClient();
    const { data: existing } = await supabase.from("youtube_connections").select("google_refresh_token").eq("user_id", user.id).maybeSingle();
    const { error } = await supabase.from("youtube_connections").upsert({
      user_id: user.id, google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token || existing?.google_refresh_token || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    return finish(error ? "error=db_error" : "success=connected");
  } catch {
    return finish("error=connection_failed");
  }
}
