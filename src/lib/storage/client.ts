"use client";

import { createClient } from "@/lib/supabase/client";
import { MAX_MEDIA_BYTES, MEDIA_BUCKET, mediaExtension } from "./shared";

export async function uploadCreatorMedia(blob: Blob): Promise<{ storagePath: string; url: string }> {
  const extension = mediaExtension(blob.type);
  if (!blob.size || blob.size > MAX_MEDIA_BYTES) throw new Error("Media must be between 1 byte and 50 MB.");
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Please log in to upload media.");
  const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error("Unable to upload media. Check Storage setup.");
  const { data, error: signError } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(storagePath, 3600);
  if (signError || !data?.signedUrl) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw new Error("Unable to access uploaded media.");
  }
  return { storagePath, url: data.signedUrl };
}

export async function discardCreatorMedia(storagePath: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
}
