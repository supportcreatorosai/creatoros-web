"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateProfileNameAction(fullName: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    console.error("Profile update error:", err);
    return { success: false, error: err.message || "Failed to update profile" };
  }
}
