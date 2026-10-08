import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AnalyticsClient from "./analytics-client";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch real data
  const [
    { data: videos },
    { data: images },
    { data: youtubeUploads }
  ] = await Promise.all([
    supabase.from('saved_videos').select('id, created_at').eq('user_id', user.id),
    supabase.from('saved_images').select('id, created_at').eq('user_id', user.id),
    supabase.from('youtube_uploads').select('id, created_at').eq('user_id', user.id)
  ]);

  const rawData = {
    videos: videos || [],
    images: images || [],
    youtubeUploads: youtubeUploads || []
  };

  return <AnalyticsClient initialData={rawData} />;
}
