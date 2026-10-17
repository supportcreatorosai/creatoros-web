"use server"

import { getCustomUser } from "@/lib/auth/session";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enforceRateLimit, RateLimitError, RateLimitUnavailableError } from "@/lib/security/rate-limit";
import { fetchMedia } from "@/lib/security/safe-fetch";
import { assertOwnedMediaPath } from "@/lib/storage/shared";
import { signMediaPath, uploadMediaBuffer, removeMediaPath } from "@/lib/storage/server";

const CaptionSchema = z.object({
  word: z.string().min(1).max(200), start: z.number().min(0).max(15), end: z.number().min(0).max(15),
}).refine(caption => caption.end >= caption.start, "Invalid caption timing");
const CaptionResultSchema = z.object({ captions: z.array(CaptionSchema).max(1000), hashtags: z.array(z.string().max(100)).max(10) });
const ShortInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  videoUrl: z.string().url().max(5000).optional(),
  videoStoragePath: z.string().max(150).optional(),
  scriptData: z.object({ captions: z.array(CaptionSchema).max(1000), selectedStyle: z.string().max(50), captionsBurned: z.boolean().optional() }),
  hashtags: z.string().max(1000),
}).refine(data => Boolean(data.videoStoragePath || data.videoUrl), "Video is required");

export async function generateCaptionsAction(audioBase64: string) {
  try {
    if (typeof audioBase64 !== "string" || audioBase64.length > 2_000_000) return { success: false, error: "Audio is too large. Use a clip up to 15 seconds." };
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
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)) return { success: false, error: "Invalid audio data." };
    const bytes = Buffer.from(base64Data, "base64");
    if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") return { success: false, error: "Please provide WAV audio." };
    const supabase = await createClient();
    await enforceRateLimit(supabase, "caption-generate", 10, 3600);

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
                    mimeType: 'audio/wav',
                    data: base64Data
                }
            }
        ],
        config: {
           responseMimeType: "application/json",
           maxOutputTokens: 4096,
           abortSignal: AbortSignal.timeout(30000),
        }
    });

    const responseText = response.text;
    if (!responseText) {
       return { success: false, error: "AI generated empty response." };
    }

    const json = CaptionResultSchema.parse(JSON.parse(responseText));
    
    return { success: true, data: json };

  } catch (error: unknown) {
    if (error instanceof RateLimitError || error instanceof RateLimitUnavailableError) return { success: false, error: error.message };
    console.error("Caption Generation Error:", error);
    return { success: false, error: "Caption generation failed. Please try again." };
  }
}

export async function saveShortAction(data: z.input<typeof ShortInputSchema>) {
  try {
    const parsed = ShortInputSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Invalid short details or captions." };
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    await enforceRateLimit(supabase, "short-save", 30, 3600);
    let storagePath = parsed.data.videoStoragePath;
    let uploaded = false;
    if (storagePath) {
      assertOwnedMediaPath(storagePath, user.id);
      if (!/\.(mp4|webm)$/.test(storagePath)) return { success: false, error: "Invalid video format." };
      await signMediaPath(supabase, user.id, storagePath);
    } else {
      const media = await fetchMedia(parsed.data.videoUrl!, { maxBytes: 50 * 1024 * 1024, allowedTypes: ["video/mp4", "video/webm"] });
      const saved = await uploadMediaBuffer(supabase, user.id, media.buffer, media.contentType);
      storagePath = saved.storagePath;
      uploaded = true;
    }
    
    // Add videoUrl to scriptData so we can play it from the Media Library
    const scriptJson = {
       ...parsed.data.scriptData,
       video_storage_path: storagePath,
    };

    const { error: insertError } = await supabase
      .from("content")
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        description: parsed.data.hashtags,
        script: JSON.stringify(scriptJson),
        status: "ready",
        content_type: "short_video",
        platform: "general",
      });

    if (insertError) {
      if (uploaded) await removeMediaPath(supabase, user.id, storagePath!).catch(() => {});
      console.error("Supabase insert error:", insertError);
      return { success: false, error: "Failed to save short to database." };
    }

    revalidatePath("/dashboard/media");
    revalidatePath("/dashboard/captions");
    return { success: true };
  } catch (error) {
    if (error instanceof RateLimitError || error instanceof RateLimitUnavailableError) return { success: false, error: error.message };
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
          .select("id, name, video_url, storage_path, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
    
        if (error) return { success: false, error: "Failed to fetch videos." };
        const videos = await Promise.all((data || []).map(async video => ({ ...video, video_url: video.storage_path ? await signMediaPath(supabase, user.id, video.storage_path) : video.video_url })));
        return { success: true, videos };
      } catch {
        return { success: false, error: "An unexpected error occurred." };
      }
}

export async function deleteShortAction(id: string) {
  try {
    if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Invalid short ID." };
    const { data: { user } } = await getCustomUser();
    if (!user) return { success: false, error: "Unauthorized." };
    const supabase = await createClient();
    const { data, error: lookupError } = await supabase.from("content").select("script, content_type").eq("id", id).eq("user_id", user.id).single();
    if (lookupError || !data) return { success: false, error: "Short not found." };
    if (!['short','short_video'].includes(data.content_type)) return { success:false,error:'Short not found.' };
    const { error } = await supabase.from("content").delete().eq("id", id).eq("user_id", user.id).eq("content_type", data.content_type);
    if (error) return { success: false, error: "Failed to delete short." };
    try {
      const script = JSON.parse(data.script || "{}");
      if (typeof script.video_storage_path === "string") await removeMediaPath(supabase, user.id, script.video_storage_path);
    } catch { console.error("Short deleted; storage cleanup requires retry."); }
    revalidatePath("/dashboard/media");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete short." };
  }
}
