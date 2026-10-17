"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Play, Square, Volume2, Loader2, Save, Trash2, Video, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { saveVoiceAction, getSavedVoicesAction, deleteVoiceAction, improveVoiceScriptAction, type SavedVoice } from "@/app/actions/voice-actions";
import { useSpeechPreview } from "@/lib/speech/use-speech-preview";
import { uploadCreatorMedia, discardCreatorMedia } from '@/lib/storage/client';
import { MediaLibraryScriptPicker } from '@/components/media-library-script-picker';

const fieldClass = "w-full rounded-xl border border-border bg-background/50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export default function VoiceStudioPage() {
  const speech = useSpeechPreview();
  const [voiceName, setVoiceName] = useState("");
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [tone, setTone] = useState("Engaging");
  const [script, setScript] = useState("");
  const [name, setName] = useState("");
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<{blob: Blob; url: string} | null>(null);
  const [aiVoice, setAiVoice] = useState('Kore');
  const [audioStyle, setAudioStyle] = useState('neutral');
  const generatedUrl = useRef<string | null>(null);
  const generationController = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { generationController.current?.abort(); if (generatedUrl.current) URL.revokeObjectURL(generatedUrl.current); }, []);
  useEffect(() => { if (audioRef.current) { audioRef.current.volume = volume; audioRef.current.playbackRate = speed; } }, [volume, speed, generatedAudio]);
  const clearGenerated = () => {
    generationController.current?.abort();
    if (generatedUrl.current) URL.revokeObjectURL(generatedUrl.current);
    generatedUrl.current = null; setGeneratedAudio(null); setGenerating(false);
  };
  const generateAudio = async () => {
    speech.stop(); clearGenerated(); setError(null); setGenerating(true);
    const controller = new AbortController(); generationController.current = controller;
    try {
      const response = await fetch('/api/voice/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({text: script, voice: aiVoice, style: audioStyle}), signal: controller.signal });
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || 'Audio generation failed.'); }
      if (!response.headers.get('content-type')?.startsWith('audio/wav')) throw new Error('The provider did not return a playable audio file.');
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob); generatedUrl.current = url; setGeneratedAudio({blob,url});
      toast.success('Audio ready. Press Play below to listen.');
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Audio generation failed.'); }
    finally { if (!controller.signal.aborted) setGenerating(false); }
  };
  const playing = speech.status === "playing" || speech.status === "starting";

  useEffect(() => {
    let disposed = false;
    getSavedVoicesAction().then(result => {
      if (disposed) return;
      if (result.success) setSavedVoices(result.voices ?? []);
      else setError(result.error ?? "Could not load saved scripts.");
      setLoadingLibrary(false);
    }).catch(() => {
      if (!disposed) { setError("Could not load saved scripts."); setLoadingLibrary(false); }
    });
    return () => { disposed = true; };
  }, []);

  const previewEditor = () => {
    setError(null);
    setActivePreview("editor");
    speech.speak(script, { voiceName, rate: speed, volume });
  };

  const improveScript = async () => {
    speech.stop();
    setError(null);
    setImproving(true);
    try {
      const result = await improveVoiceScriptAction(script, tone);
      if (!result.success || !result.script) throw new Error(result.error || "Could not improve the script.");
      setScript(result.script);
      clearGenerated();
      toast.success("Script improved. Review the text before using it.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not improve the script."); }
    finally { setImproving(false); }
  };

  const saveScript = async () => {
    setSaving(true);
    setError(null);
    let uploadedPath: string | undefined;
    let recordOutcomeUnknown = false;
    try {
      if (generatedAudio) uploadedPath = (await uploadCreatorMedia(generatedAudio.blob)).storagePath;
      recordOutcomeUnknown = true;
      const result = await saveVoiceAction({
        name: name.trim(), script_text: script,
        voice_preset: generatedAudio ? aiVoice : voiceName || "System default", tone, speed,
        storage_path: uploadedPath,
      });
      recordOutcomeUnknown = false;
      if (!result.success) throw new Error(result.error || "Could not save the script.");
      // The record owns this upload now, even if refreshing the library fails.
      uploadedPath = undefined;
      toast.success(generatedAudio ? 'Audio and script saved.' : 'Script and voice settings saved.');
      try {
        const library = await getSavedVoicesAction();
        if (library.success) setSavedVoices(library.voices ?? []);
        else setError('Saved successfully. Refresh the page to reload your library.');
      } catch { setError('Saved successfully. Refresh the page to reload your library.'); }
    } catch (failure) {
      if (uploadedPath && !recordOutcomeUnknown) await discardCreatorMedia(uploadedPath).catch(() => undefined);
      setError(recordOutcomeUnknown ? 'Could not confirm the save. Check your library before saving again.' : failure instanceof Error ? failure.message : "Could not save the script.");
    }
    finally { setSaving(false); }
  };

  const deleteScript = async (id: string) => {
    if (!window.confirm("Delete this saved script?")) return;
    if (activePreview === id) speech.stop();
    setDeleting(id);
    setError(null);
    try {
      const result = await deleteVoiceAction(id);
      if (!result.success) throw new Error(result.error || "Could not delete the script.");
      setSavedVoices(items => items.filter(item => item.id !== id));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not delete the script."); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold"><Mic className="text-violet-500" /> Voice Studio</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Generate a playable voiceover, download the WAV, or preview your script with a voice on this device.</p>
        </div>
        <Link href="/dashboard/video-generator" className={`${buttonClass} bg-fuchsia-600 text-white hover:bg-fuchsia-700`}><Video className="h-4 w-4" /> Create narrated video</Link>
      </div>

      {(error || speech.error) && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error || speech.error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Voice settings</h2>
          <label className="block text-sm">AI voice<select value={aiVoice} disabled={generating || saving} onChange={event => { clearGenerated(); setAiVoice(event.target.value); }} className={`${fieldClass} mt-2`}><option>Kore</option><option>Puck</option><option>Aoede</option></select></label>
          <label className="block text-sm">Delivery<select value={audioStyle} disabled={generating || saving} onChange={event => { clearGenerated(); setAudioStyle(event.target.value); }} className={`${fieldClass} mt-2`}><option value="neutral">Natural</option><option value="cheerful">Cheerful</option><option value="calm">Calm</option></select></label>
          <div>
            <label htmlFor="device-voice" className="mb-2 block text-sm font-medium">Device voice</label>
            <select id="device-voice" className={fieldClass} value={voiceName} disabled={playing || speech.supported === false} onChange={event => setVoiceName(event.target.value)}>
              <option value="">System default</option>
              {speech.voices.map(voice => <option key={voice.voiceURI} value={voice.name}>{voice.name} ({voice.lang})</option>)}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">{speech.supported === null ? "Checking available voices…" : speech.supported === false ? "This browser does not support speech preview." : speech.voices.length === 0 ? "Device voices are loading. You can try the system default." : `${speech.voices.length} device voices available. Voices may differ on another device.`}</p>
          </div>
          <div>
            <label htmlFor="speech-speed" className="mb-2 flex justify-between text-sm font-medium">Speed <span>{speed.toFixed(1)}×</span></label>
            <input id="speech-speed" type="range" min="0.5" max="2" step="0.1" value={speed} disabled={playing} onChange={event => setSpeed(Number(event.target.value))} className="w-full accent-violet-500" />
          </div>
          <div>
            <label htmlFor="speech-volume" className="mb-2 flex justify-between text-sm font-medium"><span className="flex items-center gap-2"><Volume2 className="h-4 w-4" /> Volume</span><span>{Math.round(volume * 100)}%</span></label>
            <input id="speech-volume" type="range" min="0.1" max="1" step="0.1" value={volume} disabled={playing} onChange={event => setVolume(Number(event.target.value))} className="w-full accent-violet-500" />
          </div>
          <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">AI generation creates a WAV file. Device preview uses your browser voices and is available separately.</div>
        </section>

        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold">Script editor</h2>
          <MediaLibraryScriptPicker id="voice-library-script" maxCharacters={10000} disabled={improving || saving || generating} onLoad={item => {
            speech.stop(); clearGenerated(); setActivePreview(null); setError(null);
            setScript(item.text); setName(item.title.slice(0, 150));
          }} />
          <label className={`${buttonClass} w-fit cursor-pointer border border-border text-sm hover:bg-muted`}>
            Import .txt file
            <input type="file" accept=".txt,text/plain" className="sr-only" disabled={improving || saving || generating} onChange={async event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 1024 * 1024) { setError("Choose a text file under 1 MB."); return; }
              const text = (await file.text()).trim();
              if (!text) { setError("The selected file is empty."); return; }
              speech.stop(); clearGenerated(); setActivePreview(null); setError(null);
              setScript(text.slice(0, 10000)); setName(file.name.replace(/\.[^.]+$/, "").slice(0, 150));
            }} />
          </label>
          <label htmlFor="voice-script" className="sr-only">Narration script</label>
          <textarea id="voice-script" value={script} maxLength={10000} rows={9} disabled={improving || saving || generating} placeholder="Write or paste the script you want to hear…" onChange={event => { speech.stop(); clearGenerated(); setScript(event.target.value); }} className={`${fieldClass} resize-y`} />
          <div className="space-y-3">
            <button onClick={generateAudio} disabled={generating || improving || saving || !script.trim() || script.trim().length > 3000} className={`${buttonClass} bg-violet-600 text-white hover:bg-violet-700`}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}{generating ? 'Generating audio…' : 'Generate audio'}</button>
            <p className="text-xs text-muted-foreground">{script.trim().length > 3000 ? 'This script is longer than the 3,000-character AI audio limit. Shorten it, or use device preview for the full script.' : 'AI audio accepts up to 3,000 characters per generation.'}</p>
            {script.trim().length > 3000 && <button type="button" disabled={generating || improving || saving} onClick={() => {
              speech.stop(); clearGenerated(); setActivePreview(null); setScript(script.trim().slice(0, 3000));
            }} className={`${buttonClass} border border-border hover:bg-muted`}>Use first 3,000 characters for AI audio</button>}
            {generatedAudio && <div className="space-y-3 rounded-xl border border-border p-4"><audio ref={audioRef} key={generatedAudio.url} src={generatedAudio.url} controls preload="metadata" className="w-full" onError={() => setError('Audio playback failed. Download the WAV or try generating again.')} /><a href={generatedAudio.url} download="creatoros-voice.wav" className="inline-block text-sm text-violet-400 underline">Download WAV</a></div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button onClick={previewEditor} disabled={!script.trim() || playing || speech.supported === false || improving} className={`${buttonClass} bg-violet-600 text-white hover:bg-violet-700`}><Play className="h-4 w-4" /> Play preview</button>
              <button onClick={speech.stop} disabled={!playing} className={`${buttonClass} border border-border hover:bg-muted`}><Square className="h-4 w-4" /> Stop</button>
            </div>
            <p aria-live="polite" className="text-sm text-muted-foreground">{activePreview === "editor" && playing ? speech.status === "starting" ? "Starting speech…" : "Playing preview" : activePreview === "editor" && speech.status === "complete" ? "Preview complete" : `${script.length.toLocaleString()} / 10,000 characters`}</p>
          </div>
          {activePreview === "editor" && speech.spokenCharacters > 0 && <p className="text-xs text-muted-foreground" aria-live="off">Read {Math.min(speech.spokenCharacters, script.trim().length)} of {script.trim().length} characters</p>}
          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-5">
            <div className="min-w-40 flex-1">
              <label htmlFor="script-tone" className="mb-2 block text-sm font-medium">Writing tone for AI rewrite</label>
              <select id="script-tone" className={fieldClass} value={tone} disabled={improving} onChange={event => setTone(event.target.value)}><option>Engaging</option><option>Educational</option><option>Calm</option></select>
            </div>
            <button onClick={improveScript} disabled={improving || !script.trim() || saving} className={`${buttonClass} border border-border hover:bg-muted`}>{improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {improving ? "Improving…" : "Improve with AI"}</button>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-5">
            <div className="min-w-40 flex-1"><label htmlFor="script-name" className="mb-2 block text-sm font-medium">Script name</label><input id="script-name" className={fieldClass} value={name} maxLength={150} disabled={saving} onChange={event => setName(event.target.value)} placeholder="e.g. Introduction to neural networks" /></div>
            <button onClick={saveScript} disabled={saving || generating || !name.trim() || !script.trim() || improving} className={`${buttonClass} bg-violet-600 text-white hover:bg-violet-700`}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : generatedAudio ? 'Save audio and script' : "Save script"}</button>
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">Saved scripts</h2>
        {loadingLibrary ? <p className="text-muted-foreground">Loading scripts…</p> : savedVoices.length === 0 ? <p className="text-muted-foreground">Save a script above to reuse it in Video Generator.</p> : savedVoices.map(item => (
          <article key={item.id} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{item.voice_preset} · {item.speed}×</p></div>
              <div className="flex gap-2">
                <button aria-label={`Preview ${item.name}`} disabled={speech.supported === false} onClick={() => {
                  if (activePreview === item.id && playing) speech.stop();
                  else { setError(null); setActivePreview(item.id); speech.speak(item.script_text, { voiceName: item.voice_preset, rate: item.speed, volume }); }
                }} className={`${buttonClass} border border-border hover:bg-muted`}>{activePreview === item.id && playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                <button onClick={() => { speech.stop(); clearGenerated(); setScript(item.script_text); setName(item.name); setSpeed(item.speed); setVoiceName(speech.voices.some(voice => voice.name === item.voice_preset) ? item.voice_preset : ""); }} className={`${buttonClass} border border-border hover:bg-muted`}>Load</button>
                <button aria-label={`Delete ${item.name}`} onClick={() => deleteScript(item.id)} disabled={deleting === item.id} className={`${buttonClass} text-red-400 hover:bg-red-500/10`}>{deleting === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
              </div>
            </div>
            <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.script_text}</p>
            {item.audio_url && <audio src={item.audio_url} controls preload="none" className="mt-3 w-full" />}
          </article>
        ))}
      </section>
    </div>
  );
}
