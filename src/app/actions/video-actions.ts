"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCustomUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enforceRateLimit, RateLimitError, RateLimitUnavailableError } from "@/lib/security/rate-limit";
import { fetchMedia, validateMediaUrl } from "@/lib/security/safe-fetch";
import { uploadMediaBuffer, signMediaPath, removeMediaPath, copyMediaPath } from "@/lib/storage/server";
import { assertOwnedMediaPath, MAX_MEDIA_BYTES } from "@/lib/storage/shared";
import { generateSpeech } from "@/lib/speech/generate";
import { deleteLocalRender, downloadLocalRender, getLocalRenderStatus, isLocalJob, localRenderer, LocalRendererError, submitLocalRender, type LocalRenderer } from "@/lib/video/local-renderer";
import { aiOrchestrator } from "@/lib/ai/orchestrator";
import { fitSlides, slidePlanPrompt, slidesNarration, VideoSlidesSchema, type VideoSlide } from "@/lib/video/slides";
import { VIDEO_FORMATS, MAX_PRESENTER_PHOTO_BYTES, MAX_VIDEO_SCRIPT_LENGTH, PRESENTER_PHOTO_STYLE, VIDEO_PRESENTERS, VIDEO_VOICES, type VideoGenerationOptions } from "@/lib/video/config";

export type SavedVideo = {
  id: string; user_id: string; name: string; video_url: string;
  avatar_name: string; storage_path?: string | null; created_at: string;
};

export type PresenterPhoto = { id: string; name: string; storagePath: string; url: string };

export type VideoJobSummary = { id: string; name: string | null; avatar_name: string | null; status: string; created_at: string };

const jobIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Invalid video job.");
const generationSchema = z.object({
  text: z.string().trim().max(MAX_VIDEO_SCRIPT_LENGTH, "Script is too long."),
  /** The creator's own narration (WAV or MP3) instead of a generated voice. */
  audio: z.instanceof(File).refine(file => file.size > 0 && file.size <= MAX_NARRATION_AUDIO_BYTES, "Audio files must be between 1 byte and 6 MB.").optional(),
  avatarUrl: z.string().url().max(2048).optional(),
  voiceId: z.string().refine(id => VIDEO_VOICES.some(voice => voice.id === id), "Unsupported narration voice.").optional(),
  speed: z.number().min(0.5).max(2).default(1),
  name: z.string().trim().max(150).optional(),
  avatarName: z.string().trim().max(100).optional(),
  photoPath: z.string().max(150).optional(),
  slides: VideoSlidesSchema.optional(),
  format: z.enum(["short", "long"]).default("long"),
});
const saveSchema = z.object({
  name: z.string().trim().min(1).max(150),
  video_url: z.string().url().max(4096),
  avatar_name: z.string().trim().min(1).max(100),
  job_id: jobIdSchema.optional(),
});

function actionError(error: unknown, fallback: string) {
  return error instanceof RateLimitError || error instanceof RateLimitUnavailableError || error instanceof LocalRendererError ? error.message : fallback;
}

const STORED = "storage:";

function providerHeaders() {
  const raw = process.env.D_ID_API_KEY?.trim().replace(/^Basic\s+/i, "");
  if (!raw || /[\r\n]/.test(raw)) throw new Error("PROVIDER_UNCONFIGURED");
  const key = raw.includes(":") ? Buffer.from(raw).toString("base64") : raw;
  return { Authorization: `Basic ${key}`, "Content-Type": "application/json", Accept: "application/json" };
}

function providerError(status: number) {
  if (status === 401 || status === 403) return "The video provider credentials or permissions need to be checked by the administrator.";
  if (status === 402) return "The video provider has insufficient credits. Contact the administrator.";
  if (status === 429) return "The video provider is busy. Please try again shortly.";
  if (status === 451) return "The video provider could not accept this script or presenter image. Try different content.";
  return "The video provider could not process the request. Check the script and public presenter image, then try again.";
}

/** Plans explainer slides (headings, notes, narration) from a script with the configured AI provider. */
export async function planSlidesAction(script: string, format: "short" | "long" = "long"): Promise<{ success: boolean; slides?: VideoSlide[]; error?: string }> {
  const text = z.string().trim().min(20, "Write at least a sentence or two to make slides.").max(MAX_VIDEO_SCRIPT_LENGTH).safeParse(script);
  if (!text.success) return { success: false, error: text.error.issues[0].message };
  try {
    const { data: { user }, error } = await getCustomUser();
    if (error || !user) return { success: false, error: "Please sign in to plan slides." };
    await enforceRateLimit(await createClient(), "ai-generate", 30, 3600);
    const budget = format === "short" ? VIDEO_FORMATS.short.maxScript - 100 : undefined;
    const result = await aiOrchestrator.generateSlides({ task: "script_generation", prompt: slidePlanPrompt(budget) + text.data, temperature: 0.4 });
    if (!result.data) return { success: false, error: "Could not plan slides from this script. Try again or turn slides off." };
    return { success: true, slides: fitSlides(result.data, budget) };
  } catch (error) {
    return { success: false, error: actionError(error, "Could not plan slides from this script.") };
  }
}

const MAX_NARRATION_AUDIO_BYTES = 6 * 1024 * 1024;

function narrationAudioType(bytes: Uint8Array): "audio/wav" | "audio/mpeg" | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  if (ascii(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

export async function generateVideoAction(text: string, avatarUrl?: string, options: VideoGenerationOptions = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) return { success: false, error: "Invalid video settings." };
  const input = generationSchema.safeParse({ text, avatarUrl, ...options });
  if (!input.success) return { success: false, error: input.error.issues[0].message };
  if (input.data.audio && input.data.slides) return { success: false, error: "Slides need a script so they can follow the narration. Turn slides off to use your own audio." };
  // With slides, the presenter speaks exactly the slides' narration so the visuals stay in sync.
  const script = input.data.slides ? slidesNarration(input.data.slides) : input.data.text;
  if (!input.data.audio && !script) return { success: false, error: "A script is required." };
  let uploadedAudio: Uint8Array | null = null;
  if (input.data.audio) {
    uploadedAudio = new Uint8Array(await input.data.audio.arrayBuffer());
    if (!narrationAudioType(uploadedAudio)) return { success: false, error: "Upload a WAV or MP3 audio file." };
  }
  if (script.length > VIDEO_FORMATS[input.data.format].maxScript) {
    return { success: false, error: `Short-form videos are limited to about a minute (${VIDEO_FORMATS.short.maxScript} characters). Shorten the script or choose long form.` };
  }
  try {
    const { data: { user }, error } = await getCustomUser();
    if (error || !user) return { success: false, error: "Please sign in to generate videos." };
    let renderer: LocalRenderer | null;
    try { renderer = localRenderer(); }
    catch { return { success: false, error: "The local video renderer address is invalid. Check TALKING_HEAD_URL." }; }
    let headers: ReturnType<typeof providerHeaders> | null = null;
    if (!renderer) {
      try { headers = providerHeaders(); }
      catch { return { success: false, error: "Video generation is not configured. Start the local renderer or add a D-ID API key." }; }
    }
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (renderer && !geminiKey && !uploadedAudio) return { success: false, error: "Local video narration needs GEMINI_API_KEY to be configured." };
    const supabase = await createClient();
    let service: ReturnType<typeof createServiceClient>;
    try { service = createServiceClient(); }
    catch { return { success: false, error: "Video job storage is not configured. The administrator must configure server storage before generating videos." }; }
    // Fail before requesting a billable render when the required migration is absent.
    const { error: setupError } = await service.from("video_jobs").select("id, name, avatar_name").limit(1);
    if (setupError) return { success: false, error: "Video generation setup is incomplete. The administrator must apply the database migration." };
    // D-ID requires a presenter image: the creator's own photo, a stock presenter, or the default presenter.
    let sourceUrl: string;
    let voiceId = input.data.voiceId;
    if (input.data.photoPath) {
      try { assertOwnedMediaPath(input.data.photoPath, user.id); }
      catch { return { success: false, error: "Choose one of your presenter photos again." }; }
      if (!/\.(jpg|png)$/.test(input.data.photoPath)) return { success: false, error: "Presenter photos must be JPG or PNG images." };
      try { sourceUrl = await signMediaPath(supabase, user.id, input.data.photoPath); }
      catch { return { success: false, error: "Your presenter photo could not be found. Upload it again." }; }
    } else {
      const stock = VIDEO_PRESENTERS.find(presenter => presenter.url === (input.data.avatarUrl ?? VIDEO_PRESENTERS[0]?.url));
      if (!stock) return { success: false, error: "Choose one of the available presenters or upload your own photo." };
      sourceUrl = stock.url;
      // Stock presenters keep a matching voice: a male presenter never speaks with a female voice, and vice versa.
      voiceId ??= stock.voiceId;
      const chosen = VIDEO_VOICES.find(item => item.id === voiceId);
      if (stock.gender && chosen?.gender && chosen.gender !== stock.gender) {
        return { success: false, error: `${stock.name} needs a ${stock.gender} voice. Choose one of the ${stock.gender} voices.` };
      }
    }
    voiceId ??= VIDEO_VOICES[0].id;
    await enforceRateLimit(supabase, "video-generate", 5, 3600);
    let jobId: string;
    if (renderer) {
      // Self-hosted path: Gemini narrates, then the local SadTalker server animates the photo.
      const voice = VIDEO_VOICES.find(item => item.id === voiceId);
      let image: Uint8Array, audio: Uint8Array;
      try {
        [image, audio] = await Promise.all([
          fetchMedia(sourceUrl, { maxBytes: MAX_PRESENTER_PHOTO_BYTES, allowedTypes: ["image/jpeg", "image/png", "application/octet-stream"] }).then(media => media.buffer),
          uploadedAudio ?? generateSpeech({ text: script, voice: voice?.geminiVoice ?? "Kore", style: "neutral" }, { apiKey: geminiKey!, model: process.env.GEMINI_TTS_MODEL }),
        ]);
      } catch (failure) {
        return { success: false, error: failure instanceof Error && /speech|voice|audio|quota/i.test(failure.message) ? failure.message : "Could not prepare the presenter photo and narration. Try again." };
      }
      jobId = await submitLocalRender(renderer, { image, audio, speed: input.data.speed, slides: input.data.slides, format: input.data.format });
    } else {
      let audioUrl: string | null = null;
      if (uploadedAudio) {
        // D-ID reads uploaded narration from its own storage.
        const form = new FormData();
        form.append("audio", input.data.audio!, narrationAudioType(uploadedAudio) === "audio/wav" ? "narration.wav" : "narration.mp3");
        const upload = await fetch("https://api.d-id.com/audios", {
          method: "POST", headers: { Authorization: headers!.Authorization }, body: form, signal: AbortSignal.timeout(60_000),
        });
        const uploaded: { url?: unknown } = upload.ok ? await upload.json() : {};
        if (typeof uploaded.url !== "string") return { success: false, error: upload.ok ? "The video provider did not accept the audio." : providerError(upload.status) };
        audioUrl = uploaded.url;
      }
      const response = await fetch("https://api.d-id.com/talks", {
        method: "POST", headers: headers!, signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          script: audioUrl ? { type: "audio", audio_url: audioUrl } : { type: "text", input: script, provider: {
            type: "microsoft", voice_id: voiceId, voice_config: { rate: String(input.data.speed) },
          } },
          config: { stitch: true, result_format: "mp4" },
          source_url: sourceUrl,
        }),
      });
      if (!response.ok) return { success: false, error: providerError(response.status) };
      const result: { id?: unknown } = await response.json();
      const id = jobIdSchema.safeParse(result.id);
      if (!id.success || isLocalJob(id.data)) return { success: false, error: "The video provider returned an invalid job. Please contact support." };
      jobId = id.data;
    }
    const { error: insertError } = await service.from("video_jobs").insert({
      id: jobId, user_id: user.id, status: "created",
      name: input.data.name || null,
      avatar_name: input.data.avatarName || null,
    });
    if (insertError) {
      if (renderer) await deleteLocalRender(renderer, jobId);
      return { success: false, error: "The video was requested but its job could not be saved. Contact support before generating again." };
    }
    return { success: true, id: jobId };
  } catch (error) {
    return { success: false, error: actionError(error, "Video generation could not start. Check the presenter image and try again.") };
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function presenterPhotoType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return "image/png";
  return null;
}

/** Stores a creator's own face photo privately so it can be used as a video presenter. */
export async function uploadPresenterPhotoAction(formData: FormData) {
  const file = formData.get("photo");
  if (!(file instanceof File) || !file.size) return { success: false, error: "Choose a JPG or PNG photo to upload." };
  if (file.size > MAX_PRESENTER_PHOTO_BYTES) return { success: false, error: "Presenter photos must be 10 MB or smaller." };
  try {
    const { data: { user }, error } = await getCustomUser();
    if (error || !user) return { success: false, error: "Please sign in to upload presenter photos." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = presenterPhotoType(bytes);
    if (!contentType) return { success: false, error: "Presenter photos must be JPG or PNG images." };
    const supabase = await createClient();
    await enforceRateLimit(supabase, "presenter-photo", 20, 3600);
    const uploaded = await uploadMediaBuffer(supabase, user.id, bytes, contentType);
    const name = z.string().trim().min(1).max(100).safeParse(formData.get("name")).data ?? "My photo";
    const { data: row, error: insertError } = await supabase.from("saved_images").insert({
      user_id: user.id, name, image_url: `storage:${uploaded.storagePath}`, storage_path: uploaded.storagePath, style: PRESENTER_PHOTO_STYLE,
    }).select("id").single();
    if (insertError || !row) {
      await removeMediaPath(supabase, user.id, uploaded.storagePath).catch(() => undefined);
      return { success: false, error: "Could not save your photo. Please try again." };
    }
    revalidatePath("/dashboard/media");
    return { success: true, photo: { id: row.id as string, name, storagePath: uploaded.storagePath, url: uploaded.url } satisfies PresenterPhoto };
  } catch (error) {
    return { success: false, error: actionError(error, "Could not upload your photo. Check that private media storage is configured and try again.") };
  }
}

export async function getPresenterPhotosAction() {
  try {
    const { data: { user }, error } = await getCustomUser();
    if (error || !user) return { success: false, error: "Please sign in." };
    const supabase = await createClient();
    const { data, error: queryError } = await supabase.from("saved_images").select("id, name, storage_path").eq("user_id", user.id).eq("style", PRESENTER_PHOTO_STYLE).order("created_at", { ascending: false }).limit(24);
    if (queryError) return { success: false, error: "Could not load your presenter photos." };
    const rows = (data ?? []) as { id: string; name: string; storage_path: string | null }[];
    const photos = await Promise.all(rows.filter(row => row.storage_path && /\.(jpg|png)$/.test(row.storage_path)).map(async row => ({
      id: row.id, name: row.name, storagePath: row.storage_path!, url: await signMediaPath(supabase, user.id, row.storage_path!),
    })));
    return { success: true, photos: photos satisfies PresenterPhoto[] };
  } catch { return { success: false, error: "Could not load your presenter photos." }; }
}

export async function getVideoJobsAction() {
  try {
    const { data: { user }, error } = await getCustomUser();
    if (error || !user) return { success: false, error: "Please sign in to view video jobs." };
    const supabase = await createClient();
    const { data, error: queryError } = await supabase.from("video_jobs").select("id, name, avatar_name, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
    if (queryError) return { success: false, error: "Could not load recent video jobs. Check database setup." };
    return { success: true, jobs: (data ?? []) as VideoJobSummary[] };
  } catch { return { success: false, error: "Could not load recent video jobs." }; }
}

export async function checkVideoStatusAction(id: string) {
  const parsedId = jobIdSchema.safeParse(id);
  if (!parsedId.success) return { success: false, error: "Invalid video job." };
  try {
    const { data: { user }, error } = await getCustomUser();
    if (error || !user) return { success: false, error: "Please sign in to check videos." };
    const supabase = await createClient();
    const { data: job, error: jobError } = await supabase.from("video_jobs").select("id, status, result_url").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (jobError || !job) return { success: false, error: "Video job not found for your account." };
    await enforceRateLimit(supabase, "video-status", 120, 60);
    if (isLocalJob(parsedId.data)) return await checkLocalVideo(supabase, user.id, parsedId.data, job.result_url);
    let headers: ReturnType<typeof providerHeaders>;
    try { headers = providerHeaders(); }
    catch { return { success: false, error: "Video generation is not configured." }; }
    const response = await fetch(`https://api.d-id.com/talks/${encodeURIComponent(id)}`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { success: false, error: providerError(response.status) };
    const result: { status?: unknown; result_url?: unknown } = await response.json();
    const status = typeof result.status === "string" ? result.status : "processing";
    if (status === "done" && typeof result.result_url !== "string") return { success: false, error: "The provider completed this job without a video URL. Please contact support." };
    let videoUrl: string | null = null;
    if (status === "done" && typeof result.result_url === "string") {
      const url = await validateMediaUrl(result.result_url);
      if (url.protocol !== "https:") return { success: false, error: "The provider returned an invalid video URL." };
      videoUrl = url.toString();
    }
    const { error: updateError } = await createServiceClient().from("video_jobs").update({ status, result_url: videoUrl }).eq("id", id).eq("user_id", user.id);
    if (updateError) return { success: false, error: "Could not update your video job. Try checking it again." };
    return { success: true, status, videoUrl, error_message: ["error", "rejected", "failed"].includes(status) ? "The provider could not render this script or image. Try different content." : null };
  } catch (error) {
    return { success: false, error: actionError(error, "Could not check video status. Please try again.") };
  }
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Local renders are copied into private storage once, so later checks no longer need the renderer. */
async function checkLocalVideo(supabase: ServerClient, userId: string, id: string, resultUrl?: string | null) {
  if (resultUrl?.startsWith(STORED)) {
    try { return { success: true, status: "done", videoUrl: await signMediaPath(supabase, userId, resultUrl.slice(STORED.length)), error_message: null }; }
    catch { return { success: false, error: "This video is no longer available. Generate it again." }; }
  }
  const renderer = localRenderer();
  if (!renderer) return { success: false, error: "This video was started on the local renderer, which is no longer configured." };
  const local = await getLocalRenderStatus(renderer, id);
  const service = createServiceClient();
  if (local.status !== "done") {
    const status = local.status === "queued" ? "created" : local.status === "processing" ? "started" : "error";
    await service.from("video_jobs").update({ status }).eq("id", id).eq("user_id", userId);
    return { success: true, status, videoUrl: null, error_message: status === "error" ? local.error || "The local renderer could not create this video." : null };
  }
  const video = await downloadLocalRender(renderer, id, MAX_MEDIA_BYTES);
  const uploaded = await uploadMediaBuffer(supabase, userId, video, "video/mp4");
  const { data: updated, error: updateError } = await service.from("video_jobs")
    .update({ status: "done", result_url: `${STORED}${uploaded.storagePath}` })
    .eq("id", id).eq("user_id", userId).is("result_url", null).select("id");
  if (updateError || !updated?.length) {
    // Another check already stored this render; keep that copy.
    await removeMediaPath(supabase, userId, uploaded.storagePath).catch(() => undefined);
    return { success: false, error: "Could not store your video yet. Check the job again." };
  }
  await deleteLocalRender(renderer, id);
  return { success: true, status: "done", videoUrl: uploaded.url, error_message: null };
}

export async function saveVideoAction(data: { name: string; video_url: string; avatar_name: string; job_id?: string }) {
  const input = saveSchema.safeParse(data);
  if (!input.success) return { success: false, error: "Add a video name and a valid generated video." };
  try {
    const { data: { user }, error } = await getCustomUser();
    if (error || !user) return { success: false, error: "Please sign in to save videos." };
    const supabase = await createClient();
    let query = supabase.from("video_jobs").select("id, result_url").eq("user_id", user.id).eq("status", "done");
    query = input.data.job_id ? query.eq("id", input.data.job_id) : query.eq("result_url", input.data.video_url);
    const { data: job, error: jobError } = await query.limit(1).maybeSingle();
    if (jobError || !job?.result_url) return { success: false, error: "This generated video does not belong to your account or is not ready yet." };
    await enforceRateLimit(supabase, "video-save", 20, 3600);
    // Local renders already live in private storage; the library gets its own copy so deleting one keeps the other.
    const uploaded = job.result_url.startsWith(STORED)
      ? await copyMediaPath(supabase, user.id, job.result_url.slice(STORED.length))
      : await fetchMedia(job.result_url, { maxBytes: 40 * 1024 * 1024, allowedTypes: ["video/mp4"] }).then(media => uploadMediaBuffer(supabase, user.id, media.buffer, media.contentType));
    const { error: insertError } = await supabase.from("saved_videos").insert({
      user_id: user.id, name: input.data.name, video_url: `storage:${uploaded.storagePath}`,
      storage_path: uploaded.storagePath, avatar_name: input.data.avatar_name,
    });
    if (insertError) {
      await removeMediaPath(supabase, user.id, uploaded.storagePath).catch(() => undefined);
      return { success: false, error: "Could not save the video. Please try again." };
    }
    ["/dashboard", "/dashboard/media", "/dashboard/calendar", "/dashboard/analytics", "/dashboard/avatar-studio", "/dashboard/video-generator"].forEach(path => revalidatePath(path));
    return { success: true, videoUrl: uploaded.url };
  } catch (error) {
    return { success: false, error: actionError(error, "Could not store the video. Check that private media storage is configured and try again.") };
  }
}

export async function getSavedVideosAction() {
  try {
    const { data: { user }, error } = await getCustomUser();
    if (error || !user) return { success: false, error: "Please sign in." };
    const supabase = await createClient();
    const { data, error: fetchError } = await supabase.from("saved_videos").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (fetchError) return { success: false, error: "Could not load saved videos." };
    const videos = await Promise.all(((data ?? []) as SavedVideo[]).map(async video => ({
      ...video, video_url: video.storage_path ? await signMediaPath(supabase, user.id, video.storage_path) : video.video_url,
    })));
    return { success: true, videos };
  } catch { return { success: false, error: "Could not load saved videos." }; }
}

export async function deleteVideoAction(id: string) {
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Invalid video." };
  try {
    const { data: { user }, error } = await getCustomUser();
    if (error || !user) return { success: false, error: "Please sign in." };
    const supabase = await createClient();
    const { data: video, error: lookupError } = await supabase.from("saved_videos").select("storage_path").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (lookupError || !video) return { success: false, error: "Video not found." };
    const { error: deleteError } = await supabase.from("saved_videos").delete().eq("id", id).eq("user_id", user.id);
    if (deleteError) return { success: false, error: "Could not delete video." };
    if (video.storage_path) await removeMediaPath(supabase, user.id, video.storage_path).catch(() => console.warn("Video record deleted; media cleanup needs attention."));
    ["/dashboard", "/dashboard/media", "/dashboard/calendar", "/dashboard/analytics"].forEach(path => revalidatePath(path));
    return { success: true };
  } catch { return { success: false, error: "Could not delete video." }; }
}
