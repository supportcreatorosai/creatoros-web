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
    { data: videos, error: videoError },
    { data: images, error: imageError },
    { data: youtubeUploads, error: youtubeError }
  ] = await Promise.all([
    supabase.from('saved_videos').select('id, created_at').eq('user_id', user.id),
    supabase.from('saved_images').select('id, created_at').eq('user_id', user.id),
    supabase.from('youtube_uploads').select('id, created_at').eq('user_id', user.id)
  ]);
  if (videoError || imageError || youtubeError) return <p role="alert" className="p-8 text-destructive">Unable to load analytics. Check database setup and try again.</p>;

  const rawData = {
    videos: videos || [],
    images: images || [],
    youtubeUploads: youtubeUploads || []
  };

  return <AnalyticsClient initialData={rawData} />;
}
