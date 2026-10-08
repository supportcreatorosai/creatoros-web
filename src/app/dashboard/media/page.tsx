import { FolderHeart, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { MediaClient, Asset } from "./media-client";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { data: { user } } = await getCustomUser();
  
  if (!user) {
    return <div>Unauthorized. Please log in.</div>;
  }

  const supabase = await createClient();

  // Fetch from content table (lessons)
  const { data: contentData } = await supabase
    .from("content")
    .select("id, title, content_type, created_at, script, description")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch from saved_videos
  const { data: videosData } = await supabase
    .from("saved_videos")
    .select("id, name, created_at, video_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch from saved_voices
  const { data: voicesData } = await supabase
    .from("saved_voices")
    .select("id, name, created_at, script_text")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch from saved_images
  const { data: imagesData } = await supabase
    .from("saved_images")
    .select("id, name, created_at, image_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const assets: Asset[] = [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (contentData) {
    contentData.forEach(item => {
      if (item.content_type === 'lesson') {
        assets.push({
          id: item.id,
          name: item.title,
          type: 'lesson',
          date: formatDate(item.created_at),
          script: item.script,
          description: item.description,
        });
      }
    });
  }

  if (videosData) {
    videosData.forEach(item => {
      assets.push({
        id: item.id,
        name: item.name,
        type: 'video',
        date: formatDate(item.created_at),
        url: item.video_url,
      });
    });
  }

  if (voicesData) {
    voicesData.forEach(item => {
      assets.push({
        id: item.id,
        name: item.name,
        type: 'audio',
        date: formatDate(item.created_at),
        script: item.script_text,
      });
    });
  }

  if (imagesData) {
    imagesData.forEach(item => {
      assets.push({
        id: item.id,
        name: item.name,
        type: 'image',
        date: formatDate(item.created_at),
        url: item.image_url,
      });
    });
  }

  // Sort combined array by date descending (rough approximation since we formatted them, better to sort by raw date if needed)
  assets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const resolvedSearchParams = await searchParams;

  // Determine initial tab from URL ?tab=Videos
  let defaultTab = 'All';
  if (resolvedSearchParams?.tab) {
    const t = String(resolvedSearchParams.tab).toLowerCase();
    if (t === 'lessons') defaultTab = 'Lessons';
    if (t === 'videos') defaultTab = 'Videos';
    if (t === 'audio') defaultTab = 'Audio';
    if (t === 'images') defaultTab = 'Images';
  }

  return (
    <div className="min-h-[85vh] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
            <FolderHeart className="w-7 h-7 text-emerald-500" />
            Media Library
          </h1>
          <p className="text-muted-foreground mt-1">Manage all your generated and uploaded assets.</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-5 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Upload Asset
        </button>
      </div>

      <MediaClient initialAssets={assets} defaultTab={defaultTab} />
    </div>
  );
}
