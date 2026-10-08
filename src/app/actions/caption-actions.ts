"use server"

import { getCustomUser } from "@/lib/auth/session";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function generateCaptionsAction(audioBase64: string) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Gemini API key is not configured." };
    }

    const ai = new GoogleGenAI({ apiKey });

    // The audioBase64 string might include the data URI prefix, strip it if necessary
    const base64Data = audioBase64.split(',')[1] || audioBase64;
    
    if (!base64Data) {
       return { success: false, error: "Empty audio data." };
    }

    const prompt = `You are a professional video captioner and social media expert.
I have provided an audio clip from a short video (up to 15 seconds). 
Listen to the audio carefully and do two things:
1. Transcribe the audio exactly as spoken. For each word spoken, determine the precise start and end time in seconds (e.g. 1.25, 1.80).
2. Generate 5 highly viral, trending hashtags related to the content of the audio.

Return ONLY a valid JSON object matching exactly this structure (no markdown formatting, no code blocks):
{
  "captions": [
    {"word": "Hello", "start": 0.1, "end": 0.5},
    {"word": "world", "start": 0.5, "end": 1.0}
  ],
  "hashtags": ["#viral", "#trending"]
}`;

    // Note: mimeType can be audio/webm if using MediaRecorder, or audio/mp3. Gemini supports audio/mp3, audio/wav, audio/webm, etc.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            prompt,
            {
                inlineData: {
                    mimeType: 'audio/webm',
                    data: base64Data
                }
            }
        ],
        config: {
           responseMimeType: "application/json",
        }
    });

    const responseText = response.text;
    if (!responseText) {
       return { success: false, error: "AI generated empty response." };
    }

    const json = JSON.parse(responseText);
    
    return { success: true, data: json };

  } catch (error: any) {
    console.error("Caption Generation Error:", error);
    return { success: false, error: error?.message || "An unexpected error occurred." };
  }
}

export async function saveShortAction(data: { title: string, videoUrl: string, scriptData: any, hashtags: string }) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    
    // Add videoUrl to scriptData so we can play it from the Media Library
    const scriptJson = {
       ...data.scriptData,
       video_url: data.videoUrl
    };

    const { error: insertError } = await supabase
      .from("content")
      .insert({
        user_id: user.id,
        title: data.title || "My Viral Short",
        description: data.hashtags,
        script: JSON.stringify(scriptJson),
        status: "ready",
        content_type: "short",
        platform: "general",
      });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return { success: false, error: "Failed to save short to database." };
    }

    revalidatePath("/dashboard/media");
    revalidatePath("/dashboard/captions");
    return { success: true };
  } catch (error) {
    console.error("Save Short Action Error:", error);
    return { success: false, error: "An unexpected error occurred while saving." };
  }
}

export async function getMediaVideosAction() {
    try {
        const { data: { user }, error: authError } = await getCustomUser();
        if (authError || !user) return { success: false, error: "Unauthorized." };
    
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("saved_videos")
          .select("id, name, video_url, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
    
        if (error) return { success: false, error: "Failed to fetch videos." };
        return { success: true, videos: data };
      } catch (error) {
        return { success: false, error: "An unexpected error occurred." };
      }
}
