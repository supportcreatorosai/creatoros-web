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

export type VideoGenerationInput = 
  | string 
  | { scriptText?: string; audioUrl?: string };

export async function generateVideoAction(input: VideoGenerationInput, avatarUrl?: string) {
  try {
    const apiKey = process.env.D_ID_API_KEY;
    if (!apiKey) {
      return { success: false, error: "D-ID API key is not configured." };
    }

    let script: Record<string, unknown>;

    if (typeof input === "string") {
      script = {
        type: 'text',
        input,
        provider: {
          type: 'microsoft',
          voice_id: 'en-US-JennyNeural',
        },
      };
    } else if (input.audioUrl) {
      script = {
        type: 'audio',
        audio_url: input.audioUrl,
      };
    } else {
      script = {
        type: 'text',
        input: input.scriptText || "Hello, this is a placeholder script. Please use Voice Studio scripts for best results.",
        provider: {
          type: 'microsoft',
          voice_id: 'en-US-JennyNeural',
        },
      };
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
        script,
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

const MAX_AUDIO_SIZE = 6 * 1024 * 1024; // 6 MB limit according to D-ID API specifications

// Uploads an audio file directly to D-ID temporary storage so it can be passed as audio_url
export async function uploadAudioAction(formData: FormData) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const apiKey = process.env.D_ID_API_KEY;
    if (!apiKey) {
      return { success: false, error: "D-ID API key is not configured." };
    }

    const file = formData.get("audio");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "No audio file provided." };
    }
    if (file.size > MAX_AUDIO_SIZE) {
      return { success: false, error: "Audio file must be smaller than 6 MB." };
    }

    const body = new FormData();
    body.append("audio", file, file.name);

    const response = await fetch("https://api.d-id.com/audios", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${apiKey}`,
      },
      body,
    });

    const data = await response.json();

    if (!response.ok || !data.url) {
      return { success: false, error: data.message || data.description || "Failed to upload audio file to D-ID." };
    }

    return { success: true, url: data.url as string };
  } catch (error) {
    console.error("Audio Upload Error:", error);
    return { success: false, error: "An unexpected error occurred while uploading audio." };
  }
}

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png"];
const MAX_AVATAR_SIZE = 10 * 1024 * 1024;

// Uploads a custom avatar image to D-ID so it can be used as a video source_url
export async function uploadAvatarImageAction(formData: FormData) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const apiKey = process.env.D_ID_API_KEY;
    if (!apiKey) {
      return { success: false, error: "D-ID API key is not configured." };
    }

    const file = formData.get("image");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "No image provided." };
    }
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      return { success: false, error: "Only JPG and PNG images are supported." };
    }
    if (file.size > MAX_AVATAR_SIZE) {
      return { success: false, error: "Image must be smaller than 10 MB." };
    }

    const body = new FormData();
    body.append("image", file, file.name);

    const response = await fetch("https://api.d-id.com/images", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${apiKey}`,
      },
      body,
    });

    const data = await response.json();

    if (!response.ok || !data.url) {
      return { success: false, error: data.message || data.description || "Failed to upload avatar image." };
    }

    return { success: true, url: data.url as string };
  } catch (error) {
    console.error("Avatar Upload Error:", error);
    return { success: false, error: "An unexpected error occurred while uploading the avatar." };
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
