"use server"

import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type SavedVideo = {
  id: string;
  user_id: string;
  name: string;
  video_url: string;
  avatar_name: string;
  created_at: string;
};

export async function generateVideoAction(text: string, avatarUrl?: string) {
  try {
    const apiKey = process.env.D_ID_API_KEY;
    if (!apiKey) {
      return { success: false, error: "D-ID API key is not configured." };
    }

    // The D-ID API key is already in the format username:password or a base64 token.
    // Use it directly in the Basic auth header.
    const response = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script: {
          type: 'text',
          input: text,
          provider: {
            type: 'microsoft',
            voice_id: 'en-US-JennyNeural',
          },
        },
        config: {
          stitch: true,
          result_format: 'mp4'
        },
        ...(avatarUrl ? { source_url: avatarUrl } : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || data.description || JSON.stringify(data) };
    }

    return { success: true, id: data.id };
  } catch (error) {
    console.error("Video Generation Error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function checkVideoStatusAction(id: string) {
  try {
    const apiKey = process.env.D_ID_API_KEY;
    if (!apiKey) {
      return { success: false, error: "D-ID API key is not configured." };
    }

    
    const response = await fetch(`https://api.d-id.com/talks/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || data.description || "Failed to check video status." };
    }

    return { 
      success: true, 
      status: data.status, // "created", "started", "done", "error"
      videoUrl: data.result_url || null,
      error_message: data.status === "error" ? "Generation failed on provider" : null
    };
  } catch (error) {
    console.error("Video Status Error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function saveVideoAction(data: { name: string; video_url: string; avatar_name: string }) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized. Please log in to save videos." };
    }

    const supabase = await createClient();
    const { error: insertError } = await supabase
      .from("saved_videos")
      .insert({
        user_id: user.id,
        name: data.name,
        video_url: data.video_url,
        avatar_name: data.avatar_name,
      });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return { success: false, error: "Failed to save video to database." };
    }

    revalidatePath("/dashboard/avatar-studio");
    return { success: true };
  } catch (error) {
    console.error("Save Video Action Error:", error);
    return { success: false, error: "An unexpected error occurred while saving." };
  }
}

export async function getSavedVideosAction() {
  try {
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("saved_videos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return { success: false, error: "Failed to fetch saved videos." };
    }

    return { success: true, videos: data as SavedVideo[] };
  } catch (error) {
    console.error("Get Saved Videos Action Error:", error);
    return { success: false, error: "An unexpected error occurred while fetching." };
  }
}

export async function deleteVideoAction(id: string) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("saved_videos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Supabase delete error:", error);
      return { success: false, error: "Failed to delete video." };
    }

    revalidatePath("/dashboard/avatar-studio");
    revalidatePath("/dashboard/media");
    return { success: true };
  } catch (error) {
    console.error("Delete Video Action Error:", error);
    return { success: false, error: "An unexpected error occurred while deleting." };
  }
}
