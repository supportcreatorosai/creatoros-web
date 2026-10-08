"use server"

import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type SavedVoice = {
  id: string;
  user_id: string;
  name: string;
  script_text: string;
  voice_preset: string;
  tone: string;
  speed: number;
  created_at: string;
};

export async function saveVoiceAction(data: { name: string; script_text: string; voice_preset: string; tone: string; speed: number }) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized. Please log in to save voices." };
    }

    const supabase = await createClient();
    const { error: insertError } = await supabase
      .from("saved_voices")
      .insert({
        user_id: user.id,
        name: data.name,
        script_text: data.script_text,
        voice_preset: data.voice_preset,
        tone: data.tone,
        speed: data.speed,
      });

    if (insertError) {
      console.error("Insert Error:", insertError);
      return { success: false, error: "Failed to save voice." };
    }

    revalidatePath("/dashboard/voice-studio");
    return { success: true };
  } catch (error: unknown) {
    console.error("Save Voice Action Error:", error);
    return { success: false, error: "An unexpected error occurred while saving." };
  }
}

export async function getSavedVoicesAction() {
  try {
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("saved_voices")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: "Failed to fetch saved voices." };
    }

    return { success: true, voices: data as SavedVoice[] };
  } catch (error: unknown) {
    console.error("Get Voices Error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function deleteVoiceAction(id: string) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("saved_voices")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id); // Ensure they own it

    if (error) {
      return { success: false, error: "Failed to delete voice." };
    }

    revalidatePath("/dashboard/voice-studio");
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete Voice Error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
