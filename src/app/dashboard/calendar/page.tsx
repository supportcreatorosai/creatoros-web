import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CalendarClient, { CalendarItem } from "./calendar-client";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch data
  const [
    { data: videos },
    { data: images },
    { data: youtubeUploads }
  ] = await Promise.all([
    supabase.from('saved_videos').select('id, name, video_url, created_at').eq('user_id', user.id),
    supabase.from('saved_images').select('id, prompt, image_url, created_at').eq('user_id', user.id),
    supabase.from('youtube_uploads').select('id, title, video_url, created_at').eq('user_id', user.id)
  ]);

  const items: CalendarItem[] = [];

  videos?.forEach(v => items.push({
    id: v.id,
    title: v.name || "AI Generated Video",
    type: 'video',
    created_at: v.created_at,
    url: v.video_url
  }));

  images?.forEach(i => items.push({
    id: i.id,
    title: i.prompt || "AI Generated Image",
    type: 'image',
    created_at: i.created_at,
    url: i.image_url
  }));

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
