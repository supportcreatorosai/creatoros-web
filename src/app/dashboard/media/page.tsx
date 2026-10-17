import { FolderHeart, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { MediaClient, Asset } from "./media-client";
import Link from "next/link";
import { signMediaPath } from "@/lib/storage/server";

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { data: { user } } = await getCustomUser();
  
  if (!user) {
    return <div>Unauthorized. Please log in.</div>;
  }

  const supabase = await createClient();

  // Fetch from content table (lessons)
  const [contentResult, videosResult, voicesResult, imagesResult] = await Promise.all([
    supabase
    .from("content")
    .select("id, title, content_type, created_at, script, description")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false }),

  // Fetch from saved_videos
  supabase
    .from("saved_videos")
    .select("id, name, created_at, video_url, storage_path")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false }),

  // Fetch from saved_voices
  supabase
    .from("saved_voices")
    .select("id, name, created_at, script_text, storage_path")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false }),

  // Fetch from saved_images
  supabase
    .from("saved_images")
    .select("id, name, created_at, image_url, storage_path")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false }),
  ]);
  if ([contentResult, videosResult, voicesResult, imagesResult].some(result => result.error)) throw new Error("Unable to load media. Check database setup and try again.");
  const contentData = contentResult.data;
  const videosData = videosResult.data;
  const voicesData = voicesResult.data;
  const imagesData = imagesResult.data;

  const assets: Asset[] = [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (contentData) {
    await Promise.all(contentData.map(async item => {
      if (item.content_type === 'lesson') {
        assets.push({
          id: item.id,
          name: item.title,
          type: 'lesson',
          date: formatDate(item.created_at),
          script: item.script,
          description: item.description,
          source: "content", createdAt: item.created_at,
        });
      } else {
        let url: string | undefined;
        try {
          const script = JSON.parse(item.script || "{}");
          if (typeof script.video_storage_path === "string") url = await signMediaPath(supabase, user.id, script.video_storage_path).catch(() => undefined);
          else if (typeof script.video_url === "string" && script.video_url.startsWith("https://")) url = script.video_url;
        } catch { /* Text-only content has no video reference. */ }
        assets.push({ id: item.id, name: item.title, type: url ? "video" : "document", date: formatDate(item.created_at), createdAt: item.created_at, source: "content", script: item.script, description: item.description, url, contentType: item.content_type });
      }
    }));
  }

  if (videosData) {
    await Promise.all(videosData.map(async item => {
      assets.push({
        id: item.id,
        name: item.name,
        type: 'video',
        date: formatDate(item.created_at),
        url: item.storage_path ? await signMediaPath(supabase, user.id, item.storage_path).catch(() => undefined) : item.video_url,
        source: "saved_videos", createdAt: item.created_at,
      });
    }));
  }

  if (voicesData) {
    await Promise.all(voicesData.map(async item => {
      assets.push({
        id: item.id,
        name: item.name,
        type: 'audio',
        date: formatDate(item.created_at),
        script: item.script_text,
        url: item.storage_path ? await signMediaPath(supabase,user.id,item.storage_path).catch(() => undefined) : undefined,
        source: "saved_voices", createdAt: item.created_at,
      });
    }));
  }

  if (imagesData) {
    await Promise.all(imagesData.map(async item => {
      assets.push({
        id: item.id,
        name: item.name,
        type: 'image',
        date: formatDate(item.created_at),
        url: item.storage_path ? await signMediaPath(supabase, user.id, item.storage_path).catch(() => undefined) : item.image_url,
        source: "saved_images", createdAt: item.created_at,
      });
    }));
  }

  // Sort combined array by date descending (rough approximation since we formatted them, better to sort by raw date if needed)
  assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const resolvedSearchParams = await searchParams;

  // Determine initial tab from URL ?tab=Videos
  let defaultTab = 'All';
  if (resolvedSearchParams?.tab) {
    const t = String(resolvedSearchParams.tab).toLowerCase();
    if (t === 'lessons') defaultTab = 'Lessons';
    if (t === 'videos') defaultTab = 'Videos';
    if (t === 'audio') defaultTab = 'Audio';
    if (t === 'images') defaultTab = 'Images';
    if (t === 'documents') defaultTab = 'Documents';
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
        <Link href="/dashboard/captions" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-5 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center gap-2">
          <Plus className="w-5 h-5" />
           Upload a Video
        </Link>
      </div>

      <MediaClient initialAssets={assets} defaultTab={defaultTab} />
    </div>
  );
}
