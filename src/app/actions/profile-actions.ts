"use server";

import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { z } from 'zod';

export async function updateProfileNameAction(fullName: string) {
  try {
    const parsed = z.string().trim().min(2).max(100).safeParse(fullName);
    if (!parsed.success) return { success: false, error: 'Name must contain 2 to 100 characters.' };
    const supabase = await createClient();
    const { data: { user } } = await getCustomUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: parsed.data, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) throw error;

    return { success: true };
  } catch {
    return { success: false, error: "Failed to update profile" };
  }
}
