"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Video, Loader2, Download, Save, RefreshCw, Square, Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { generateVideoAction, planSlidesAction, checkVideoStatusAction, saveVideoAction, getVideoJobsAction, getPresenterPhotosAction, uploadPresenterPhotoAction, type PresenterPhoto, type VideoJobSummary } from "@/app/actions/video-actions";
import { MediaLibraryScriptPicker } from "@/components/media-library-script-picker";
import { VIDEO_FORMATS, type VideoFormat, MAX_PRESENTER_PHOTO_BYTES, VIDEO_PRESENTERS, VIDEO_VOICES } from "@/lib/video/config";
import { pollGeneratedVideo } from "@/lib/video/poll";

const fieldClass = "w-full rounded-xl border border-border bg-background/50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
type VideoJob = { id: string; name: string; presenter: string };
type PresenterChoice = { kind: "stock"; index: number } | { kind: "photo"; photo: PresenterPhoto };
const tileClass = "group relative overflow-hidden rounded-xl border-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60";

export function VideoGenerator() {
  const [script, setScript] = useState("");
  const [name, setName] = useState("");
  const [presenter, setPresenter] = useState<PresenterChoice>({ kind: "stock", index: 0 });
  const [photos, setPhotos] = useState<PresenterPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [voiceId, setVoiceId] = useState<string>(VIDEO_VOICES[0].id);
  // Uploaded photos have no known gender, so the creator picks which voices fit their presenter.
  const [photoGender, setPhotoGender] = useState<"female" | "male">("female");
  const [speed, setSpeed] = useState(1);
  const [withSlides, setWithSlides] = useState(false);
  // Narration comes from a script (generated voice) or the creator's own recording.
  const [narration, setNarration] = useState<"script" | "audio">("script");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const useOwnAudio = narration === "audio";
  const ready = Boolean(name.trim()) && (useOwnAudio ? Boolean(audioFile) : Boolean(script.trim()));
  const [format, setFormat] = useState<VideoFormat>("long");
  const maxScript = VIDEO_FORMATS[format].maxScript;
  const [recentJobs, setRecentJobs] = useState<VideoJobSummary[]>([]);
  const [job, setJob] = useState<VideoJob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    getVideoJobsAction().then(result => {
      if (mountedRef.current && result.success) setRecentJobs(result.jobs ?? []);
    }).catch(() => undefined);
    getPresenterPhotosAction().then(result => {
      if (mountedRef.current && result.success) setPhotos(result.photos ?? []);
    }).catch(() => undefined);
    return () => { mountedRef.current = false; controllerRef.current?.abort(); };
  }, []);

  const checkJob = async (activeJob: VideoJob, controller: AbortController) => {
    const url = await pollGeneratedVideo(activeJob.id, checkVideoStatusAction, {
      signal: controller.signal,
      onStatus: value => setStatus(value === "created" ? "Your video is queued for rendering…" : activeJob.id.startsWith("local_") ? "Rendering on the local GPU. This can take several minutes…" : "Rendering your video…"),
    });
    if (!controller.signal.aborted && mountedRef.current) {
      setVideoUrl(url);
      setRecentJobs(items => items.map(item => item.id === activeJob.id ? { ...item, status: "done" } : item));
      setStatus("Video ready. Press Play to hear the narration.");
      toast.success("Your narrated video is ready.");
    }
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setError(null);
    setVideoUrl(null);
    setJob(null);
    setSaved(false);
    setStatus(withSlides ? "Planning slides and notes from your script…" : "Starting video generation…");
    try {
      let slides: Awaited<ReturnType<typeof planSlidesAction>>["slides"];
      if (withSlides && !useOwnAudio) {
        const plan = await planSlidesAction(script, format);
        if (controller.signal.aborted) return;
        if (!plan.success || !plan.slides) throw new Error(plan.error || "Could not plan slides.");
        slides = plan.slides;
        setStatus(`Planned ${slides.length} slides. Starting video generation…`);
      }
      const result = presenter.kind === "photo"
        ? await generateVideoAction(script, undefined, { voiceId, speed, name: name.trim(), avatarName: presenter.photo.name, photoPath: presenter.photo.storagePath, slides, format, audio: useOwnAudio ? audioFile ?? undefined : undefined })
        : await generateVideoAction(script, VIDEO_PRESENTERS[presenter.index].url, { voiceId, speed, name: name.trim(), avatarName: VIDEO_PRESENTERS[presenter.index].name, slides, format, audio: useOwnAudio ? audioFile ?? undefined : undefined });
      if (controller.signal.aborted) return;
      if (!result.success || !result.id) throw new Error(result.error || "Could not start video generation.");
      const nextJob = { id: result.id, name: name.trim(), presenter: presenterName };
      setJob(nextJob);
      setRecentJobs(items => [{ id: nextJob.id, name: nextJob.name, avatar_name: nextJob.presenter, status: "created", created_at: new Date().toISOString() }, ...items].slice(0, 10));
      await checkJob(nextJob, controller);
    } catch (failure) {
      if (!controller.signal.aborted && mountedRef.current) { setError(failure instanceof Error ? failure.message : "Video generation failed."); setStatus(""); }
    } finally {
      if (!controller.signal.aborted && mountedRef.current) setBusy(false);
    }
  };

  const resumeChecking = async (activeJob: VideoJob | null = job) => {
    if (!activeJob) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setBusy(true);
    setError(null);
    setStatus("Checking the existing video job…");
    try { await checkJob(activeJob, controller); }
    catch (failure) { if (!controller.signal.aborted && mountedRef.current) { setError(failure instanceof Error ? failure.message : "Could not check video status."); setStatus(""); } }
    finally { if (!controller.signal.aborted && mountedRef.current) setBusy(false); }
  };

  const presenterName = presenter.kind === "photo" ? presenter.photo.name : VIDEO_PRESENTERS[presenter.index].name;
  const presenterImage = presenter.kind === "photo" ? presenter.photo.url : VIDEO_PRESENTERS[presenter.index].thumbnail;

  const presenterGender = presenter.kind === "photo" ? photoGender : VIDEO_PRESENTERS[presenter.index].gender;
  const matchingVoices = VIDEO_VOICES.filter(item => item.gender === presenterGender);

  const choosePhotoGender = (gender: "female" | "male") => {
    setPhotoGender(gender);
    setVoiceId(VIDEO_VOICES.find(item => item.gender === gender)!.id);
  };

  const choosePhoto = (photo: PresenterPhoto) => {
    setPresenter({ kind: "photo", photo });
    setVoiceId(VIDEO_VOICES.find(item => item.gender === photoGender)!.id);
  };

  const chooseStock = (index: number) => {
    setPresenter({ kind: "stock", index });
    setVoiceId(VIDEO_PRESENTERS[index].voiceId);
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!["image/jpeg", "image/png"].includes(file.type)) { setError("Presenter photos must be JPG or PNG images."); return; }
    if (file.size > MAX_PRESENTER_PHOTO_BYTES) { setError("Presenter photos must be 10 MB or smaller."); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("photo", file);
      form.set("name", file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "My photo");
      const result = await uploadPresenterPhotoAction(form);
      if (!result.success || !result.photo) throw new Error(result.error || "Could not upload your photo.");
      const photo = result.photo;
      if (mountedRef.current) { setPhotos(items => [photo, ...items]); choosePhoto(photo); }
      toast.success("Photo added. It is now your presenter.");
    } catch (failure) { if (mountedRef.current) setError(failure instanceof Error ? failure.message : "Could not upload your photo."); }
    finally {
      if (mountedRef.current) setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const stopChecking = () => {
    controllerRef.current?.abort();
    setBusy(false);
    setStatus("Status checking stopped. Rendering continues; check this job again when you are ready.");
  };

  const save = async () => {
    if (!job || !videoUrl) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveVideoAction({ name: job.name, avatar_name: job.presenter, video_url: videoUrl, job_id: job.id });
      if (!result.success) throw new Error(result.error || "Could not save video.");
      if (mountedRef.current) { setSaved(true); if (result.videoUrl) setVideoUrl(result.videoUrl); }
      toast.success("Video saved to your Media Library.");
    } catch (failure) { if (mountedRef.current) setError(failure instanceof Error ? failure.message : "Could not save video."); }
    finally { if (mountedRef.current) setSaving(false); }
  };

  const download = async () => {
    if (!videoUrl || !job) return;
    setDownloading(true);
    setError(null);
    try {
      const filename = `${job.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.mp4`;
      const response = await fetch(`/api/download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(filename)}`);
      if (!response.ok) throw new Error("Could not download this video. Check the video status to refresh its link and try again.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { if (mountedRef.current) setError(failure instanceof Error ? failure.message : "Could not download video."); }
    finally { if (mountedRef.current) setDownloading(false); }
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold"><Video className="text-fuchsia-500" /> Video Generator</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Turn your script into a talking presenter video with generated narration. Preview it, download the MP4, or save it to your library.</p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={generate} className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Your video</h2>
          <div><label htmlFor="video-name" className="mb-2 block text-sm font-medium">Video name</label><input id="video-name" value={name} maxLength={150} required disabled={busy || saving} onChange={event => setName(event.target.value)} className={fieldClass} placeholder="e.g. Welcome to the course" /></div>
          <div role="radiogroup" aria-label="Narration source" className="grid grid-cols-2 gap-2 rounded-xl bg-background/50 p-1 text-sm">
            {([["script", "Write a script"], ["audio", "Upload your audio"]] as const).map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={narration === key} disabled={busy || saving} onClick={() => setNarration(key)} className={`rounded-lg px-3 py-2 font-medium transition-colors ${narration === key ? "bg-fuchsia-600 text-white" : "text-muted-foreground hover:bg-muted"}`}>{label}</button>
            ))}
          </div>
          {useOwnAudio ? <div>
            <label htmlFor="video-audio" className="mb-2 block text-sm font-medium">Your narration (WAV or MP3, up to 6 MB)</label>
            <input id="video-audio" type="file" accept="audio/wav,audio/x-wav,audio/mpeg,.wav,.mp3" disabled={busy || saving} onChange={event => {
              const file = event.target.files?.[0] ?? null;
              setError(null);
              if (file && file.size > 6 * 1024 * 1024) { setError("Audio files must be 6 MB or smaller."); event.target.value = ""; setAudioFile(null); return; }
              setAudioFile(file);
            }} className={`${fieldClass} file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-600 file:px-3 file:py-1 file:text-white`} />
            <p className="mt-2 text-xs text-muted-foreground">The presenter lip-syncs to your recording, for example a Voice Studio download or your own voice.</p>
          </div> : <>
          <MediaLibraryScriptPicker id="video-library-script" maxCharacters={maxScript} disabled={busy || saving} onLoad={selected => {
            setScript(selected.text);
            setName(selected.title.slice(0, 150));
            setError(null);
          }} />
          <div><label htmlFor="video-script" className="mb-2 block text-sm font-medium">Narration script</label><textarea id="video-script" value={script} rows={8} maxLength={maxScript} required disabled={busy || saving} onChange={event => setScript(event.target.value)} className={`${fieldClass} resize-y`} placeholder="Write or paste exactly what the presenter should say…" /><p className="mt-2 text-xs text-muted-foreground"><span className={script.length > maxScript ? "text-red-400" : ""}>{script.length.toLocaleString()} / {maxScript.toLocaleString()} characters</span></p></div>
          </>}
          <fieldset className="space-y-3">
            <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">Avatar <span className="font-normal text-muted-foreground">{presenterName}</span></legend>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {VIDEO_PRESENTERS.map((item, index) => {
                const selected = presenter.kind === "stock" && presenter.index === index;
                return <button key={item.name} type="button" aria-pressed={selected} aria-label={`Use ${item.name} as presenter`} disabled={busy || saving || uploading} onClick={() => chooseStock(index)} className={`${tileClass} ${selected ? "border-fuchsia-500" : "border-transparent hover:border-border"}`}>
                  <Image src={item.thumbnail} alt="" width={120} height={120} unoptimized className="aspect-square w-full object-cover object-top" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1 pt-4 text-xs font-medium text-white">{item.name}</span>
                  {selected && <Check className="absolute right-1 top-1 h-5 w-5 rounded-full bg-fuchsia-600 p-0.5 text-white" />}
                </button>;
              })}
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-sm font-medium">Your photos</p>
              <button type="button" disabled={busy || saving || uploading} onClick={() => photoInputRef.current?.click()} className={`${buttonClass} border border-border px-3 py-2 text-sm hover:bg-muted`}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {uploading ? "Uploading…" : "Upload photo"}</button>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png" className="hidden" aria-label="Upload a presenter photo" onChange={event => void uploadPhoto(event.target.files?.[0])} />
            </div>
            {photos.length > 0 ? <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map(photo => {
                const selected = presenter.kind === "photo" && presenter.photo.id === photo.id;
                return <button key={photo.id} type="button" aria-pressed={selected} aria-label={`Use ${photo.name} as presenter`} disabled={busy || saving || uploading} onClick={() => choosePhoto(photo)} className={`${tileClass} ${selected ? "border-fuchsia-500" : "border-transparent hover:border-border"}`}>
                  <Image src={photo.url} alt="" width={120} height={120} unoptimized className="aspect-square w-full object-cover object-top" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pb-1 pt-4 text-xs font-medium text-white">{photo.name}</span>
                  {selected && <Check className="absolute right-1 top-1 h-5 w-5 rounded-full bg-fuchsia-600 p-0.5 text-white" />}
                </button>;
              })}
            </div> : <p className="text-xs text-muted-foreground">Upload a clear, front-facing JPG or PNG photo of one person (up to 10 MB) to make it talk. Photos are kept private in your Media Library.</p>}
          </fieldset>
          {presenter.kind === "photo" && <div role="radiogroup" aria-label="Presenter voice type" className="flex items-center gap-2 text-sm">
            <span className="font-medium">Your presenter is</span>
            {(["female", "male"] as const).map(gender => <button key={gender} type="button" role="radio" aria-checked={photoGender === gender} disabled={busy || saving} onClick={() => choosePhotoGender(gender)} className={`rounded-full border px-3 py-1 capitalize ${photoGender === gender ? "border-fuchsia-500 bg-fuchsia-500/10" : "border-border hover:bg-muted"}`}>{gender}</button>)}
          </div>}
          <div><label htmlFor="video-voice" className="mb-2 block text-sm font-medium">Narration voice <span className="font-normal text-muted-foreground">({presenterGender} voices for {presenterName})</span></label><select id="video-voice" value={voiceId} disabled={busy || saving} onChange={event => setVoiceId(event.target.value)} className={fieldClass}>{matchingVoices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div><label htmlFor="video-speed" className="mb-2 flex justify-between text-sm font-medium">Narration speed <span>{speed.toFixed(1)}×</span></label><input id="video-speed" type="range" min="0.5" max="2" step="0.1" value={speed} disabled={busy || saving} onChange={event => setSpeed(Number(event.target.value))} className="w-full accent-fuchsia-500" /></div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Video format</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(VIDEO_FORMATS) as VideoFormat[]).map(key => (
                <button key={key} type="button" aria-pressed={format === key} disabled={busy || saving} onClick={() => setFormat(key)} className={`rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-60 ${format === key ? "border-fuchsia-500 bg-fuchsia-500/10" : "border-border hover:border-muted-foreground/40"}`}>
                  <span className="flex items-center gap-2 font-medium"><span className={`inline-block rounded-sm border-2 border-current ${key === "short" ? "h-5 w-3" : "h-3 w-5"}`} />{VIDEO_FORMATS[key].label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{VIDEO_FORMATS[key].detail}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
            <input type="checkbox" checked={withSlides && !useOwnAudio} disabled={busy || saving || useOwnAudio} onChange={event => setWithSlides(event.target.checked)} className="mt-0.5 h-4 w-4 accent-fuchsia-500" />
            <span><span className="font-medium">Add slides with notes</span><span className="mt-1 block text-xs text-muted-foreground">AI turns your script into slides with headings and key notes. The presenter explains each slide from a corner of the video (local renderer only; keeps the video to about a minute).</span></span>
          </label>
          <p className="text-xs text-muted-foreground">Narration uses the selected video voice. Device voices from Voice Studio are available for preview on your device.</p>
          <button type="submit" disabled={busy || saving || !ready} className={`${buttonClass} w-full bg-fuchsia-600 text-white hover:bg-fuchsia-700`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} {busy ? "Generating video…" : "Generate video"}</button>
        </form>

        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Preview</h2>
          {videoUrl ? <video key={videoUrl} src={videoUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black" onError={() => setError("Could not play the video. Check this job again to refresh the video link, or download the MP4.")} /> : <div className="flex min-h-80 flex-1 flex-col items-center justify-center gap-5 rounded-xl bg-background/50 p-6">
            {busy ? <Loader2 className="h-12 w-12 animate-spin text-fuchsia-500" /> : <Image src={presenterImage} alt={`${presenterName} presenter`} width={160} height={208} unoptimized className="h-52 w-40 rounded-xl object-cover object-top" />}
            <p className="max-w-sm text-center text-sm text-muted-foreground">{busy ? "Rendering your presenter and narration. You can leave this page and retrieve the job later." : "Your generated video will appear here. The script determines what the presenter says."}</p>
          </div>}
          {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
          {job && <p className="break-all text-xs text-muted-foreground">Video job: {job.id}</p>}
          <div className="flex flex-wrap gap-3">
            {busy && job && <button onClick={stopChecking} className={`${buttonClass} border border-border hover:bg-muted`}><Square className="h-4 w-4" /> Stop checking</button>}
            {!busy && job && <button onClick={() => resumeChecking()} disabled={saving || downloading} className={`${buttonClass} border border-border hover:bg-muted`}><RefreshCw className="h-4 w-4" /> Check job again</button>}
            {videoUrl && <><button onClick={download} disabled={downloading || saving || busy} className={`${buttonClass} border border-border hover:bg-muted`}>{downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download MP4</button><button onClick={save} disabled={saved || saving || busy} className={`${buttonClass} bg-fuchsia-600 text-white hover:bg-fuchsia-700`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saved ? "Saved to library" : saving ? "Saving video…" : "Save to library"}</button></>}
          </div>
          {videoUrl && !saved && <p className="text-xs text-muted-foreground">Save your video to keep it in the Media Library. Unsaved preview links expire.</p>}
          <Link href="/dashboard/media?tab=Videos" className="mt-auto text-sm text-fuchsia-400 hover:underline">Open video library →</Link>
        </section>
      </div>
      {recentJobs.length > 0 && <section className="space-y-4 rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-semibold">Recent video jobs</h2><p className="text-sm text-muted-foreground">Retrieve a render you started earlier without generating a new video.</p>{recentJobs.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"><div><p className="font-medium">{item.name || "Generated video"}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()} · {item.status}</p></div><button disabled={busy || saving || downloading} onClick={() => {
        const selected = { id: item.id, name: item.name || "Generated video", presenter: item.avatar_name || "AI presenter" };
        setJob(selected); setName(selected.name); setVideoUrl(null); setSaved(false); void resumeChecking(selected);
      }} className={`${buttonClass} border border-border hover:bg-muted`}><RefreshCw className="h-4 w-4" /> Check video</button></div>)}</section>}
    </div>
  );
}
