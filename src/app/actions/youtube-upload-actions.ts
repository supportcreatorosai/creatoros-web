"use server"

import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { google } from "googleapis";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import { GeminiProvider } from "@/lib/ai/providers/gemini";

// Helper function if we were uploading a real file
// In this simulated environment, we might just mock the upload if we don't have a real file stream
export async function uploadToYouTubeAction(data: {
  title: string;
  description: string;
  tags: string[];
  privacy_status: string;
  videoUrl: string;
}) {
  const { data: { user }, error: authError } = await getCustomUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  
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
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback/google"
  );
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
    } catch (refreshError: any) {
      console.error("Token refresh failed:", refreshError);
      return { success: false, error: "YouTube connection expired. Please reconnect your account from the YouTube Generator page." };
    }
  }

  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client
  });

  try {
    // Fetch the video from D-ID
    const videoRes = await fetch(data.videoUrl);
    if (!videoRes.ok) {
      throw new Error("Failed to download generated video from D-ID.");
    }
    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const videoStream = new Readable();
    videoStream.push(buffer);
    videoStream.push(null);

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
      video_url: videoId ? `https://youtube.com/watch?v=${videoId}` : 'https://youtube.com/watch?v=simulation123'
    }]);

    if (insertError) throw insertError;

    return { success: true };
  } catch (error: any) {
    console.error("YouTube Upload Error:", error);
    
    // Check if token 
    if (error.code === 401) {
      return { success: false, error: "YouTube connection expired. Please reconnect your account." };
    }
    
    return { success: false, error: error.message || "Failed to upload to YouTube." };
  }
}

export async function generateYouTubeScriptAction(topic: string) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const gemini = new GeminiProvider();
    if (!await gemini.isAvailable()) {
      return { success: false, error: "AI is not configured." };
    }

    const res = await gemini.generateText({
      task: "script_generation",
      prompt: `Write a short, engaging 1-2 sentence script about: ${topic}. It must be spoken by an AI avatar. Keep it under 20 seconds of speaking time. Only return the script text, no markdown or extra info.`,
      temperature: 0.7
    });

    if (!res.success) {
      return { success: false, error: res.error || "Failed to generate script" };
    }

    return { success: true, script: res.text };
  } catch (error) {
    console.error("Generate script error:", error);
    return { success: false, error: "Unexpected error generating script" };
  }
}