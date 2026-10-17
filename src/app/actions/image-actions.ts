"use server"

import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signMediaPath, removeMediaPath } from "@/lib/storage/server";
import { assertOwnedMediaPath } from "@/lib/storage/shared";

export type SavedImage = {
  id: string;
  user_id: string;
  name: string;
  image_url: string;
  storage_path?: string | null;
  style: string;
  created_at: string;
};

export async function saveImageAction(data: { name: string; storage_path: string; style: string }) {
  try {
    const parsed = z.object({ name: z.string().trim().min(1).max(200), storage_path: z.string().max(150), style: z.string().trim().min(1).max(100) }).safeParse(data);
    if (!parsed.success) return { success: false, error: "Invalid image details." };
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized. Please log in to save images." };
    }

    const supabase = await createClient();
    assertOwnedMediaPath(parsed.data.storage_path, user.id);
    if (!/\.(jpg|png|webp)$/.test(parsed.data.storage_path)) return { success: false, error: "Invalid image format." };
    await signMediaPath(supabase, user.id, parsed.data.storage_path);
    const { error: insertError } = await supabase
      .from("saved_images")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        image_url: `storage:${parsed.data.storage_path}`,
        storage_path: parsed.data.storage_path,
        style: parsed.data.style,
      });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return { success: false, error: "Failed to save image to database." };
    }

    revalidatePath("/dashboard/thumbnail-generator");
    revalidatePath("/dashboard/media");
    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (error) {
    console.error("Save Image Action Error:", error);
    return { success: false, error: "An unexpected error occurred while saving." };
  }
}

export async function getSavedImagesAction() {
  try {
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("saved_images")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return { success: false, error: "Failed to fetch saved images." };
    }

    const images = await Promise.all((data as SavedImage[]).map(async image => ({
      ...image,
      image_url: image.storage_path ? await signMediaPath(supabase, user.id, image.storage_path) : image.image_url,
    })));
    return { success: true, images };
  } catch (error) {
    console.error("Get Saved Images Action Error:", error);
    return { success: false, error: "An unexpected error occurred while fetching." };
  }
}

export async function deleteImageAction(id: string) {
  try {
    if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Invalid image ID." };
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    const { data: image, error: lookupError } = await supabase.from("saved_images").select("storage_path").eq("id", id).eq("user_id", user.id).single();
    if (lookupError || !image) return { success: false, error: "Image not found." };
    const { error } = await supabase
      .from("saved_images")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Supabase delete error:", error);
      return { success: false, error: "Failed to delete image." };
    }
    if (image.storage_path) {
      try { await removeMediaPath(supabase, user.id, image.storage_path); }
      catch { console.error("Saved image deleted; storage cleanup requires retry."); }
    }

    revalidatePath("/dashboard/thumbnail-generator");
    revalidatePath("/dashboard/media");
    revalidatePath("/dashboard/calendar");
    return { success: true };
  } catch (error) {
    console.error("Delete Image Action Error:", error);
    return { success: false, error: "An unexpected error occurred while deleting." };
  }
}
