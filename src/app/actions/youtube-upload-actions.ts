"use server"

import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { google } from "googleapis";
import { Readable } from "stream";
import { z } from "zod";
import { aiOrchestrator } from "@/lib/ai/orchestrator";
import { createYouTubeOAuthClient } from "@/lib/youtube/oauth";
import { fetchMedia } from "@/lib/security/safe-fetch";
import { signMediaPath } from "@/lib/storage/server";
import { enforceRateLimit, RateLimitError, RateLimitUnavailableError } from "@/lib/security/rate-limit";

const UploadSchema = z.object({
  title: z.string().trim().min(1).max(100), description: z.string().max(5000),
  tags: z.array(z.string().trim().min(1).max(100)).max(30).refine(tags => tags.join(",").length <= 500),
  privacy_status: z.enum(["private", "unlisted", "public"]), videoUrl: z.string().url().max(5000), videoJobId: z.string().min(1).max(100),
});

// Helper function if we were uploading a real file
// In this simulated environment, we might just mock the upload if we don't have a real file stream
export async function uploadToYouTubeAction(data: {
  title: string;
  description: string;
  tags: string[];
  privacy_status: string;
  videoUrl: string;
  videoJobId: string;
}) {
  const validated = UploadSchema.safeParse(data);
  if (!validated.success) return { success: false, error: "Invalid YouTube title, tags, privacy, or video details." };
  data = validated.data;
  const { data: { user }, error: authError } = await getCustomUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  try { await enforceRateLimit(supabase, "youtube-upload", 5, 3600); }
  catch (error) { return { success: false, error: error instanceof RateLimitError || error instanceof RateLimitUnavailableError ? error.message : "Upload is temporarily unavailable." }; }
  const { data: job, error: jobError } = await supabase.from("video_jobs").select("result_url, status").eq("id", data.videoJobId).eq("user_id", user.id).single();
  // Locally rendered videos are stored privately as "storage:<path>"; provider videos keep their result URL.
  const storedPath = typeof job?.result_url === "string" && job.result_url.startsWith("storage:") ? job.result_url.slice("storage:".length) : null;
  if (jobError || job?.status !== "done" || (!storedPath && job.result_url !== data.videoUrl)) return { success: false, error: "Generated video not found for this account." };
  let sourceUrl = data.videoUrl;
  if (storedPath) {
    try { sourceUrl = await signMediaPath(supabase, user.id, storedPath); }
    catch { return { success: false, error: "Generated video not found for this account." }; }
  }
  
  // 1. Get Google tokens
  const { data: connection, error: dbError } = await supabase
    .from('youtube_connections')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (dbError || !connection || !connection.google_access_token) {
    return { success: false, error: "YouTube account not connected." };
  }

  // 2. Setup Google OAuth Client with token refresh
  let oauth2Client;
  try { oauth2Client = createYouTubeOAuthClient(); }
  catch { return { success: false, error: "YouTube uploads are not configured." }; }
  oauth2Client.setCredentials({
    access_token: connection.google_access_token,
    refresh_token: connection.google_refresh_token
  });

  // Attempt to refresh the access token if we have a refresh token
  if (connection.google_refresh_token) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Save the new access token back to the database
      if (credentials.access_token) {
        await supabase
          .from('youtube_connections')
          .update({
            google_access_token: credentials.access_token,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      }
    } catch {
      return { success: false, error: "YouTube connection expired. Please reconnect your account from the YouTube Generator page." };
    }
  }

  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client
  });

  try {
    // Fetch the video from D-ID
    const { buffer } = await fetchMedia(sourceUrl, { maxBytes: 50 * 1024 * 1024, allowedTypes: ["video/mp4"] });
    const videoStream = Readable.from(buffer);

    const res = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: data.title,
          description: data.description,
          tags: data.tags,
          categoryId: '22' // People & Blogs
        },
        status: {
          privacyStatus: data.privacy_status,
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        mimeType: 'video/mp4',
        body: videoStream
      }
    });
    const videoId = res.data?.id;
    if (!videoId) return { success: false, error: "YouTube did not confirm a video ID. Check your channel before retrying." };

    // Since we don't have the actual generated video file generated here (it's a simulation), 
    // we will just save to our DB to prove it works. 
    // Uncomment the youtube.videos.insert block when you have the actual video buffer ready to upload!

    // Save to youtube_uploads
    const { error: insertError } = await supabase.from('youtube_uploads').insert([{
      user_id: user.id,
      title: data.title,
      description: data.description,
      tags: data.tags,
      privacy_status: data.privacy_status,
      status: 'published',
      video_url: `https://youtube.com/watch?v=${videoId}`
    }]);

    if (insertError) return { success: true, videoUrl: `https://youtube.com/watch?v=${videoId}`, warning: "Video uploaded successfully, but its history could not be saved." };

    return { success: true, videoUrl: `https://youtube.com/watch?v=${videoId}` };
  } catch (error: unknown) {
    
    // Check if token 
    if (error && typeof error === "object" && "code" in error && error.code === 401) {
      return { success: false, error: "YouTube connection expired. Please reconnect your account." };
    }
    
    return { success: false, error: "Failed to upload to YouTube. Check your connection and video details." };
  }
}

export async function generateYouTubeScriptAction(topic: string) {
  try {
    const parsedTopic = z.string().trim().min(1).max(200).safeParse(topic);
    if (!parsedTopic.success) return { success: false, error: "Enter a topic between 1 and 200 characters." };
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    await enforceRateLimit(supabase, "youtube-script", 10, 3600);
    const res = await aiOrchestrator.generateRaw({
      task: "script_generation",
      prompt: `Write a short, engaging 1-2 sentence script about: ${parsedTopic.data}. It must be spoken by an AI avatar. Keep it under 20 seconds of speaking time. Only return the script text, no markdown or extra info.`,
      temperature: 0.7, maxTokens: 200, responseFormat: "text",
    });

    if (!res.success) {
      return { success: false, error: res.error || "Failed to generate script" };
    }

    return { success: true, script: res.text };
  } catch (error) {
    if (error instanceof RateLimitError || error instanceof RateLimitUnavailableError) return { success: false, error: error.message };
    console.error("Generate script error:", error);
    return { success: false, error: "Unexpected error generating script" };
  }
}
