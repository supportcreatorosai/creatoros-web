"use client";

import { useState, useRef, useEffect } from "react";
import { Type, Upload, Settings2, Sparkles, Scissors, Play, Pause, Loader2, Save, X, Video } from "lucide-react";
import { generateCaptionsAction, getMediaVideosAction, saveShortAction } from "@/app/actions/caption-actions";

type Caption = { word: string; start: number; end: number };

// Helper to convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer) {
  const numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferWav = new ArrayBuffer(length),
        view = new DataView(bufferWav),
        channels = [],
        sampleRate = buffer.sampleRate;
  let offset = 0,
      pos = 0;

  function setUint16(data: number) {
    view.setUint16(offset, data, true);
    offset += 2;
  }

  function setUint32(data: number) {
    view.setUint32(offset, data, true);
    offset += 4;
  }

  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit 

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  for(let i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while(pos < buffer.length) {
    for(let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][pos]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferWav], {type: "audio/wav"});
}

export default function CaptionsPage() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState("Alex H.");
  const [isSaving, setIsSaving] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mediaVideos, setMediaVideos] = useState<any[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 15 seconds limit
  const MAX_DURATION = 15.0;

  useEffect(() => {
    if (isModalOpen && mediaVideos.length === 0) {
      getMediaVideosAction().then(res => {
        if (res.success && res.videos) setMediaVideos(res.videos);
      });
    }
  }, [isModalOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      resetState();
    }
  };

  const resetState = () => {
    setCaptions([]);
    setHashtags([]);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      let time = videoRef.current.currentTime;
      // Force loop at 15 seconds
      if (time >= MAX_DURATION) {
        videoRef.current.currentTime = 0;
        time = 0;
      }
      setCurrentTime(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(Math.min(videoRef.current.duration, MAX_DURATION));
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const extractAudio = async (url: string): Promise<string> => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      let fetchUrl = url;
      if (url.startsWith('http') && !url.startsWith('blob:')) {
         // Use proxy to bypass CORS if it's an external URL
         fetchUrl = `/api/download?url=${encodeURIComponent(url)}`;
      }

      console.log("Fetching video from:", fetchUrl);
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const arrayBuffer = await response.arrayBuffer();
      
      console.log("Decoding audio data...");
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer).catch(e => {
         throw new Error("Failed to decode audio. The video might not have an audio track or uses an unsupported codec.");
      });
      
      // Extract max 15 seconds, mono channel, 16kHz sample rate for highly optimized transcription payload
      const extractDuration = Math.min(audioBuffer.duration, MAX_DURATION);
      if (extractDuration <= 0) throw new Error("Audio duration is 0.");
      
      const sampleRate = 16000;
      const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtxClass(
        1, // 1 channel (mono)
        sampleRate * extractDuration,
        sampleRate
      );
      
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);
      
      console.log("Rendering offline audio context...");
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(wavBlob);
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to convert audio Blob to base64."));
      });
    } catch (e: any) {
      console.error("Audio Extraction Error:", e);
      throw new Error(`Extraction failed: ${e.message}`);
    }
  };

  const handleGenerate = async () => {
    if (!videoUrl) return alert("Please select a video first.");
    setIsGenerating(true);
    
    try {
      const base64Audio = await extractAudio(videoUrl);
      console.log("Audio extracted successfully, sending to Gemini...");
      const res = await generateCaptionsAction(base64Audio);
      
      if (res.success && res.data) {
        setCaptions(res.data.captions || []);
        setHashtags(res.data.hashtags || []);
      } else {
        alert(res.error || "Failed to generate captions.");
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!videoUrl) return;
    setIsSaving(true);
    
    const finalUrl = videoUrl;

    const res = await saveShortAction({
      title: "My Auto-Cut Short",
      videoUrl: finalUrl,
      scriptData: { captions, selectedStyle },
      hashtags: hashtags.join(" "),
    });

    setIsSaving(false);
    if (res.success) {
      alert("Saved successfully to Media Library!");
    } else {
      alert("Error saving: " + res.error);
    }
  };

  const burnAndDownloadVideo = async () => {
    if (!videoUrl) return;
    setIsRendering(true);

    try {
      // Fetch video as blob first to avoid canvas CORS tainting during capture
      let srcUrl = videoUrl;
      if (videoUrl.startsWith('http') && !videoUrl.startsWith('blob:')) {
         const res = await fetch(`/api/download?url=${encodeURIComponent(videoUrl)}`);
         const blob = await res.blob();
         srcUrl = URL.createObjectURL(blob);
      }
      
      const renderVideo = document.createElement('video');
      renderVideo.crossOrigin = "anonymous";
      renderVideo.src = srcUrl;
      renderVideo.muted = false;
      renderVideo.playsInline = true;
      await new Promise((r) => { renderVideo.onloadedmetadata = r; });

      const width = renderVideo.videoWidth;
      const height = renderVideo.videoHeight;
      const durationToRecord = Math.min(renderVideo.duration, MAX_DURATION);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get 2d context");

      const stream = canvas.captureStream(30);

      // Get audio track
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(renderVideo);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination); // Play audio during render so user knows it's happening
      
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'captioned_video.webm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        setIsRendering(false);
      };

      recorder.start();
      renderVideo.play().catch(e => {
        throw new Error("Failed to play video for rendering. " + e.message);
      });

      const renderFrame = () => {
        if (renderVideo.ended || renderVideo.currentTime >= durationToRecord) {
          recorder.stop();
          renderVideo.pause();
          return;
        }

        // Draw video frame
        ctx.drawImage(renderVideo, 0, 0, width, height);

        // Draw active caption
        const time = renderVideo.currentTime;
        const activeWord = captions.find(c => time >= c.start && time <= c.end)?.word;

        if (activeWord) {
           ctx.textAlign = "center";
           ctx.textBaseline = "bottom";
           
           const fontSize = Math.floor(height * 0.08); 
           let text = activeWord;
           
           if (selectedStyle === 'Alex H.') {
             ctx.font = `900 ${fontSize}px sans-serif`;
             text = text.toUpperCase();
             ctx.fillStyle = "white";
             ctx.shadowColor = "rgba(0,0,0,0.8)";
             ctx.shadowBlur = 10;
             ctx.shadowOffsetX = 4;
             ctx.shadowOffsetY = 4;
           } else if (selectedStyle === 'Minimal') {
             ctx.font = `500 ${Math.floor(fontSize * 0.8)}px sans-serif`;
             ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
             ctx.shadowColor = "transparent";
             ctx.shadowBlur = 0;
           } else if (selectedStyle === 'Karaoke') {
             ctx.font = `800 ${fontSize}px sans-serif`;
             ctx.fillStyle = "#ec4899";
             ctx.shadowColor = "rgba(0,0,0,0.8)";
             ctx.shadowBlur = 5;
           } else if (selectedStyle === 'Dynamic') {
             ctx.font = `800 ${fontSize}px sans-serif`;
             ctx.fillStyle = "#facc15";
             ctx.shadowColor = "rgba(0,0,0,0.8)";
             ctx.shadowBlur = 5;
           }

           const paddingBottom = Math.floor(height * 0.15);
           
           // Outline stroke for visibility
           if (selectedStyle !== 'Minimal') {
             ctx.strokeStyle = "black";
             ctx.lineWidth = Math.floor(fontSize * 0.15);
             ctx.strokeText(text, width / 2, height - paddingBottom);
           }
           
           ctx.fillText(text, width / 2, height - paddingBottom);
        }

        requestAnimationFrame(renderFrame);
      };

      requestAnimationFrame(renderFrame);

    } catch (e: any) {
      console.error(e);
      alert("Error rendering video: " + e.message);
      setIsRendering(false);
    }
  };

  // Find the currently active word
  const activeWordIndex = captions.findIndex(c => currentTime >= c.start && currentTime <= c.end);
  const activeCaption = captions[activeWordIndex];

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[85vh] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-3 flex items-center justify-center gap-3">
          <Type className="w-8 h-8 text-pink-500" />
          Auto-Captions & Shorts
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Turn long videos into viral 15s shorts with animated AI captions and trending hashtags.
        </p>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="flex-1 backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col min-h-[500px]">
            <div className="absolute top-1/2 left-0 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Upload className="w-5 h-5 text-pink-400" />
                Video Workspace
              </h2>
              {videoUrl && (
                <div className="flex gap-2">
                  <button onClick={() => setVideoUrl(null)} className="px-3 py-1.5 rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80">
                    Clear
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all bg-pink-500/20 text-pink-500 text-sm">
                    <Scissors className="w-4 h-4" />
                    Auto-Cut to 15s
                  </button>
                </div>
              )}
            </div>

            {!videoUrl ? (
              <div className="flex-1 border-2 border-dashed border-border/60 hover:border-pink-500/50 transition-colors rounded-2xl flex flex-col items-center justify-center text-center p-8 relative z-10 bg-background/30">
                <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-pink-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Drag & Drop your video here</h3>
                <p className="text-muted-foreground text-sm max-w-xs mb-6">
                  Supports MP4, MOV. Video will be auto-cut to 15s.
                </p>
                <div className="flex gap-4">
                  <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 rounded-xl bg-background border border-border hover:bg-muted transition-colors font-medium">
                    From Device
                  </button>
                  <button onClick={() => setIsModalOpen(true)} className="px-6 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700 transition-colors font-medium">
                    Media Library
                  </button>
                </div>
                <input type="file" accept="video/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              </div>
            ) : (
              <div className="flex-none h-[400px] w-[250px] md:w-[300px] mx-auto relative rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-border/50 group shadow-lg">
                <video 
                  ref={videoRef}
                  src={videoUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  className="max-h-full max-w-full object-contain"
                  playsInline
                />
                
                {/* Caption Overlay */}
                {activeCaption && (
                  <div className="absolute inset-0 flex items-end justify-center pointer-events-none pb-12 md:pb-16 px-4">
                    <div className={`text-center font-extrabold tracking-tight drop-shadow-2xl w-full break-words
                      ${selectedStyle === 'Alex H.' ? 'text-2xl md:text-3xl text-white uppercase transform scale-110' : ''}
                      ${selectedStyle === 'Minimal' ? 'text-xl md:text-2xl text-white/90 font-medium' : ''}
                      ${selectedStyle === 'Karaoke' ? 'text-2xl md:text-3xl text-pink-400' : ''}
                      ${selectedStyle === 'Dynamic' ? 'text-2xl md:text-3xl text-yellow-400 animate-bounce' : ''}
                    `} style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 15px rgba(0,0,0,0.5)' }}>
                      {activeCaption.word}
                    </div>
                  </div>
                )}

                {/* Play/Pause Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-pink-600/90 flex items-center justify-center text-white hover:scale-110 transition-transform">
                    {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-border/50 relative z-10">
              <div className="flex justify-between text-sm font-medium mb-3">
                <span>Timeline (Restricted to 15s)</span>
                <span className="text-muted-foreground">{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>
              <div className="h-16 bg-black/40 rounded-xl border border-white/5 relative overflow-hidden flex cursor-pointer" onClick={(e) => {
                if (videoRef.current) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const newTime = (clickX / rect.width) * duration;
                  videoRef.current.currentTime = newTime;
                }
              }}>
                <div className="w-full h-full bg-gradient-to-r from-pink-500/10 to-transparent"></div>
                {/* Playhead */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]" style={{ left: `${(currentTime / duration) * 100}%`}}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 relative z-10">
            <Settings2 className="w-5 h-5 text-pink-400" />
            Caption Style
          </h2>
          
          <div className="space-y-6 relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
            <div>
              <label className="block text-sm font-medium mb-3">Animation Style</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Alex H.', desc: 'Bold, word-by-word' },
                  { name: 'Minimal', desc: 'Clean, fade in' },
                  { name: 'Karaoke', desc: 'Highlight active' },
                  { name: 'Dynamic', desc: 'Pop and bounce' }
                ].map((style, i) => (
                  <div key={i} onClick={() => setSelectedStyle(style.name)} className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedStyle === style.name ? 'bg-pink-500/20 border-pink-500/50' : 'bg-background/50 border-border/50 hover:bg-background'}`}>
                    <div className="font-semibold text-sm mb-1">{style.name}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{style.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {hashtags.length > 0 && (
              <div className="bg-background/50 border border-border p-4 rounded-xl">
                <label className="block text-sm font-medium mb-3">Generated Hashtags</label>
                <div className="flex flex-wrap gap-2">
                  {hashtags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-pink-500/10 text-pink-400 text-xs font-semibold rounded-md border border-pink-500/20">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex flex-col gap-3 relative z-10">
            <button 
              onClick={handleGenerate}
              disabled={!videoUrl || isGenerating}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-pink-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {isGenerating ? "Transcribing & Auto-Syncing..." : "Generate Magic"}
            </button>

            {captions.length > 0 && (
              <>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSaving ? "Saving..." : "Save to Media Library"}
                </button>
                <button 
                  onClick={burnAndDownloadVideo}
                  disabled={isRendering}
                  className="w-full border border-border hover:bg-muted text-foreground font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isRendering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5 rotate-180" />}
                  {isRendering ? "Rendering..." : "Download Video"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rendering Overlay */}
      {isRendering && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <Loader2 className="w-16 h-16 text-pink-500 animate-spin mb-6" />
          <h2 className="text-3xl font-bold mb-2">Rendering Video...</h2>
          <p className="text-muted-foreground text-center max-w-sm">
            Please wait while your browser burns the captions directly into the video stream. You will hear the audio play during this real-time process.
          </p>
        </div>
      )}

      {/* Media Library Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl p-6 relative max-h-[80vh] flex flex-col">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-pink-500" />
              Select from Library
            </h3>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-2 gap-4">
              {mediaVideos.length === 0 ? (
                <div className="col-span-2 text-center text-muted-foreground py-8">No videos found in library.</div>
              ) : (
                mediaVideos.map(v => (
                  <div key={v.id} onClick={() => { setVideoUrl(v.video_url); resetState(); setIsModalOpen(false); }} className="relative aspect-video bg-black rounded-xl overflow-hidden cursor-pointer group border border-border/50 hover:border-pink-500 transition-colors">
                    <video src={v.video_url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                      <Play className="w-8 h-8 text-white mb-2 shadow-lg rounded-full bg-pink-600/80 p-2" />
                      <span className="text-white text-xs font-semibold text-center truncate w-full">{v.name}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
