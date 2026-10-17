import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CalendarClient, { CalendarItem } from "./calendar-client";
import { signMediaPath } from "@/lib/storage/server";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch data
  const [
    { data: videos, error: videoError },
    { data: images, error: imageError },
    { data: youtubeUploads, error: youtubeError }
  ] = await Promise.all([
    supabase.from('saved_videos').select('id, name, video_url, storage_path, created_at').eq('user_id', user.id),
    supabase.from('saved_images').select('id, name, image_url, storage_path, created_at').eq('user_id', user.id),
    supabase.from('youtube_uploads').select('id, title, video_url, created_at').eq('user_id', user.id)
  ]);
  if (videoError || imageError || youtubeError) return <p role="alert" className="p-8 text-destructive">Unable to load the calendar. Check database setup and try again.</p>;

  const items: CalendarItem[] = [];

  await Promise.all((videos || []).map(async v => items.push({
    id: v.id,
    title: v.name || "AI Generated Video",
    type: 'video',
    created_at: v.created_at,
    url: v.storage_path ? await signMediaPath(supabase, user.id, v.storage_path).catch(() => undefined) : v.video_url,
  })));

  await Promise.all((images || []).map(async i => items.push({
    id: i.id,
    title: i.name || "AI Generated Image",
    type: 'image',
    created_at: i.created_at,
    url: i.storage_path ? await signMediaPath(supabase, user.id, i.storage_path).catch(() => undefined) : i.image_url,
  })));

  youtubeUploads?.forEach(y => items.push({
    id: y.id,
    title: y.title || "YouTube Upload",
    type: 'youtube',
    created_at: y.created_at,
    url: y.video_url
  }));

  // Sort by created_at descending
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return <CalendarClient items={items} />;
}
