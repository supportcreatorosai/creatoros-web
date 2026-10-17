import "server-only";
import { google } from "googleapis";

export function createYouTubeOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("YouTube connection is not configured.");
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  const callback = new URL("/auth/youtube/callback", siteUrl).toString();
  return new google.auth.OAuth2(clientId, clientSecret, callback);
}

export const YOUTUBE_STATE_COOKIE = "creatoros_youtube_oauth_state";
