import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertOwnedMediaPath, MAX_MEDIA_BYTES, MEDIA_BUCKET, mediaExtension } from "./shared";

export async function signMediaPath(supabase: SupabaseClient, userId: string, path: string): Promise<string> {
  assertOwnedMediaPath(path, userId);
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error("Unable to access saved media.");
  return data.signedUrl;
}

export async function uploadMediaBuffer(supabase: SupabaseClient, userId: string, buffer: Uint8Array, contentType: string): Promise<{ storagePath: string; url: string }> {
  const extension = mediaExtension(contentType);
  if (!buffer.byteLength || buffer.byteLength > MAX_MEDIA_BYTES) throw new Error("Media must be between 1 byte and 50 MB.");
  const storagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, buffer, { contentType, upsert: false });
  if (error) throw new Error("Unable to upload media. Check Storage setup.");
  try {
    return { storagePath, url: await signMediaPath(supabase, userId, storagePath) };
  } catch (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw error;
  }
}

export async function copyMediaPath(supabase: SupabaseClient, userId: string, path: string): Promise<{ storagePath: string; url: string }> {
  assertOwnedMediaPath(path, userId);
  const storagePath = `${userId}/${crypto.randomUUID()}.${path.slice(path.lastIndexOf(".") + 1)}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).copy(path, storagePath);
  if (error) throw new Error("Unable to copy media. Check Storage setup.");
  try {
    return { storagePath, url: await signMediaPath(supabase, userId, storagePath) };
  } catch (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw error;
  }
}

export async function removeMediaPath(supabase: SupabaseClient, userId: string, path: string): Promise<void> {
  assertOwnedMediaPath(path, userId);
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw new Error("Unable to remove saved media.");
}
