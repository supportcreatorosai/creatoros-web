"use server"

import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type SavedImage = {
  id: string;
  user_id: string;
  name: string;
  image_url: string;
  style: string;
  created_at: string;
};

export async function saveImageAction(data: { name: string; image_url: string; style: string }) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized. Please log in to save images." };
    }

    const supabase = await createClient();
    const { error: insertError } = await supabase
      .from("saved_images")
      .insert({
        user_id: user.id,
        name: data.name,
        image_url: data.image_url,
        style: data.style,
      });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return { success: false, error: "Failed to save image to database." };
    }

    revalidatePath("/dashboard/thumbnail-generator");
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

    return { success: true, images: data as SavedImage[] };
  } catch (error) {
    console.error("Get Saved Images Action Error:", error);
    return { success: false, error: "An unexpected error occurred while fetching." };
  }
}

export async function deleteImageAction(id: string) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("saved_images")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Supabase delete error:", error);
      return { success: false, error: "Failed to delete image." };
    }

    revalidatePath("/dashboard/thumbnail-generator");
    revalidatePath("/dashboard/media");
    return { success: true };
  } catch (error) {
    console.error("Delete Image Action Error:", error);
    return { success: false, error: "An unexpected error occurred while deleting." };
  }
}
