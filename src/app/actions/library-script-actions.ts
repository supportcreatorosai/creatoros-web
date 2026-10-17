"use server";

import { z } from "zod";
import { getCustomUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { extractLibraryScript, type LibraryScriptSummary, type LoadedLibraryScript } from "@/lib/media/scripts";

type Failure = { success: false; error: string };
type ListResult = { success: true; scripts: LibraryScriptSummary[] } | Failure;
type LoadResult = { success: true; script: LoadedLibraryScript } | Failure;
const keySchema = z.string().max(50).regex(/^(content|voice):[0-9a-fA-F-]{36}$/).refine(value => z.string().uuid().safeParse(value.split(":")[1]).success);

function title(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : fallback;
}

function contentSource(value: unknown): string {
  if (value === "lesson") return "Lesson";
  if (value === "short" || value === "short_video") return "Short captions";
  return "Content script";
}

function loadedScript(scriptTitle: unknown, input: unknown): LoadResult {
  const scriptText = extractLibraryScript(input);
  if (!scriptText) return { success: false, error: "This item has no usable script. Choose another library item." };
  return { success: true, script: { title: title(scriptTitle, "Untitled script"), text: scriptText } };
}

export async function getLibraryScriptsAction(): Promise<ListResult> {
  try {
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) return { success: false, error: "Please sign in to use your saved scripts." };
    const supabase = await createClient();
    const [content, voices] = await Promise.all([
      supabase.from("content").select("id, title, content_type, script, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("saved_voices").select("id, name, script_text, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (content.error || voices.error) return { success: false, error: "Could not load Media Library scripts. Please try again." };
    const scripts: (LibraryScriptSummary & { createdAt: string })[] = [];
    for (const item of content.data || []) {
      if (z.string().uuid().safeParse(item.id).success && extractLibraryScript(item.script)) {
        scripts.push({ key: `content:${item.id}`, title: title(item.title, "Untitled script"), source: contentSource(item.content_type), createdAt: item.created_at || "" });
      }
    }
    for (const item of voices.data || []) {
      if (z.string().uuid().safeParse(item.id).success && extractLibraryScript(item.script_text)) {
        scripts.push({ key: `voice:${item.id}`, title: title(item.name, "Untitled voice script"), source: "Voice script", createdAt: item.created_at || "" });
      }
    }
    scripts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { success: true, scripts: scripts.map(({ key, title: scriptTitle, source }) => ({ key, title: scriptTitle, source })) };
  } catch {
    return { success: false, error: "Could not load Media Library scripts. Please try again." };
  }
}

export async function loadLibraryScriptAction(key: string): Promise<LoadResult> {
  try {
    const parsed = keySchema.safeParse(key);
    if (!parsed.success) return { success: false, error: "Choose a saved script from your Media Library." };
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) return { success: false, error: "Please sign in to use your saved scripts." };
    const [kind, id] = parsed.data.split(":");
    const supabase = await createClient();
    if (kind === "voice") {
      const { data, error } = await supabase.from("saved_voices").select("name, script_text").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (error || !data) return { success: false, error: "Saved script not found. It may have been removed." };
      return loadedScript(data.name, data.script_text);
    }
    const { data, error } = await supabase.from("content").select("title, script").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error || !data) return { success: false, error: "Saved script not found. It may have been removed." };
    return loadedScript(data.title, data.script);
  } catch {
    return { success: false, error: "Could not load the saved script. Please try again." };
  }
}
