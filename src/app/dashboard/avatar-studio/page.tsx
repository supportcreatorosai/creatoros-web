"use client";

import { useState, useEffect } from "react";
import { User, Video, Sparkles, Settings2, PlaySquare, Maximize2, Loader2, Pause, Mic, Upload, X, Save, Download } from "lucide-react";
import Image from "next/image";
import { getSavedVoicesAction, SavedVoice } from "@/app/actions/voice-actions";
import { generateVideoAction, checkVideoStatusAction, saveVideoAction } from "@/app/actions/video-actions";
import { useRouter } from "next/navigation";

const avatars = [
  { id: 1, name: "Tech Creator", src: "/avatars/avatar1.jpg" },
  { id: 2, name: "Professional", src: "/avatars/avatar2.jpg" },
  { id: 3, name: "AI Assistant", src: "/avatars/avatar3.jpg" },
];

export default function AvatarStudioPage() {
  const router = useRouter();
  const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);
  const [bgStyle, setBgStyle] = useState("Transparent (Green Screen)");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoStatusText, setVideoStatusText] = useState<string | null>(null);

  // Audio source states
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedSavedVoice, setSelectedSavedVoice] = useState<SavedVoice | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Save Video states
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [videoName, setVideoName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchVoices = async () => {
      const res = await getSavedVoicesAction();
      if (res.success && res.voices) setSavedVoices(res.voices);
    };
    fetchVoices();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return p + 0.5;
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleGenerate = async () => {
    if (!selectedSavedVoice && !uploadedFile) return;

    setIsGenerating(true);
    setIsGenerated(false);
    setProgress(0);
    setIsPlaying(false);
    setGeneratedVideoUrl(null);
    setVideoStatusText("Starting video generation...");

    try {
      let scriptText = "Hello, this is a placeholder script. Please use Voice Studio scripts for best results.";
      if (selectedSavedVoice) {
        scriptText = selectedSavedVoice.script_text;
      } else if (uploadedFile) {
        alert("Audio file uploads to D-ID require a public bucket URL. Using a fallback text script for demonstration.");
      }

      // D-ID requires a public URL. We construct it using the current origin.
      let publicAvatarUrl = `${window.location.origin}${selectedAvatar.src}`;
      
      // If we are on localhost, D-ID's servers cannot download the image. 
      // We fall back to a known public D-ID placeholder image to avoid validation failures.
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        publicAvatarUrl = "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg";
      }

      const res = await generateVideoAction(scriptText, publicAvatarUrl);
      
      if (!res.success || !res.id) {
        alert("Error starting generation: " + res.error);
        setIsGenerating(false);
        setVideoStatusText(null);
        return;
      }

      const videoId = res.id;
      setVideoStatusText("Rendering video on servers...");

      const pollInterval = setInterval(async () => {
        const statusRes = await checkVideoStatusAction(videoId);
        if (statusRes.success) {
          if (statusRes.status === "done" && statusRes.videoUrl) {
            clearInterval(pollInterval);
            setGeneratedVideoUrl(statusRes.videoUrl);
            setVideoStatusText(null);
            setIsGenerating(false);
            setIsGenerated(true);
          } else if (statusRes.status === "error") {
            clearInterval(pollInterval);
            alert("Video generation failed on provider.");
            setIsGenerating(false);
            setVideoStatusText(null);
          } else if (statusRes.status === "created") {
            setVideoStatusText(`Status: Queued (can take 3-5 mins)...`);
          } else {
            setVideoStatusText(`Status: ${statusRes.status}...`);
          }
        } else {
          clearInterval(pollInterval);
          alert("Error checking status: " + statusRes.error);
          setIsGenerating(false);
          setVideoStatusText(null);
        }
      }, 5000);
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
      setVideoStatusText(null);
    }
  };

  const togglePlay = () => {
    if (!isGenerated || !generatedVideoUrl) return;
    
    const videoEl = document.getElementById("avatar-video") as HTMLVideoElement;
    if (videoEl) {
      if (isPlaying) {
        videoEl.pause();
      } else {
        videoEl.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSaveVideo = async () => {
    if (!generatedVideoUrl || !videoName.trim()) return;
    
    setIsSaving(true);
    const res = await saveVideoAction({
      name: videoName,
      video_url: generatedVideoUrl,
      avatar_name: selectedAvatar.name
    });
    
    setIsSaving(false);
    if (res.success) {
      setIsSaveModalOpen(false);
      setVideoName("");
    } else {
      alert(res.error || "Failed to save video");
    }
  };

  const handleDownload = () => {
    if (!generatedVideoUrl) return;
    
    setIsDownloading(true);
    
    // Use our internal proxy API to bypass CORS restrictions from D-ID's S3 bucket
    const filename = `creatoros_video_${new Date().getTime()}.mp4`;
    const proxyUrl = `/api/download?url=${encodeURIComponent(generatedVideoUrl)}&filename=${encodeURIComponent(filename)}`;
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = proxyUrl;
    // The actual filename will be determined by the Content-Disposition header from the API
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Briefly show the downloading state
    setTimeout(() => {
      setIsDownloading(false);
    }, 2000);
  };

  return (
    <>
      <div className="min-h-[85vh] p-4 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-6xl mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-3 flex items-center justify-center gap-3">
          <User className="w-8 h-8 text-fuchsia-500" />
          Avatar Studio
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Bring your lessons to life with photorealistic AI presenters.
        </p>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="flex-1 backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col">
            <div className="absolute top-1/2 left-0 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Video className="w-5 h-5 text-fuchsia-400" />
                Stage Preview
              </h2>
              <button className="p-2 rounded-lg bg-background/50 border border-border/50 text-muted-foreground hover:text-foreground transition-colors">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 bg-black/40 rounded-2xl border border-white/10 relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-fuchsia-900/20"></div>
              
              <div className={`w-full h-full max-w-md mx-auto flex flex-col items-center justify-end pb-8 relative z-10 opacity-90 transition-all ${isGenerating ? 'animate-pulse scale-95' : 'scale-100'}`}>
                <div className={`w-56 h-72 bg-white/5 rounded-t-full border flex items-center justify-center backdrop-blur-sm overflow-hidden relative shadow-2xl transition-all ${isGenerated ? 'border-fuchsia-500 ring-4 ring-fuchsia-500/30' : 'border-white/20'}`}>
                  {generatedVideoUrl ? (
                    <>
                      <video 
                        id="avatar-video"
                        src={generatedVideoUrl} 
                        className="w-full h-full object-cover cursor-pointer"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        onClick={togglePlay}
                        controls={false}
                      />
                      {!isPlaying && (
                        <div 
                          className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer bg-black/20 hover:bg-black/40 transition-colors"
                          onClick={togglePlay}
                        >
                          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl">
                            <PlaySquare className="w-8 h-8 text-white ml-1" />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <Image 
                      src={selectedAvatar.src} 
                      alt={selectedAvatar.name} 
                      fill 
                      sizes="250px"
                      className="object-cover"
                    />
                  )}
                  {isGenerating && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center z-10 p-4 text-center">
                      <Loader2 className="w-12 h-12 text-fuchsia-500 animate-spin mb-4" />
                      <p className="text-xs text-white/90 font-medium">{videoStatusText}</p>
                    </div>
                  )}
                </div>
                <div className="w-64 h-32 bg-black/40 rounded-3xl border border-white/10 -mt-16 backdrop-blur-md flex flex-col items-center justify-center p-4 relative z-20 shadow-xl">
                  {isPlaying ? (
                    <>
                      <div className="w-full h-2 bg-white/20 rounded-full mb-2 overflow-hidden flex items-center justify-center">
                        <div className="w-full h-full bg-fuchsia-500/30 rounded-full flex gap-1">
                          {[...Array(20)].map((_, i) => (
                            <div key={i} className="flex-1 bg-fuchsia-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                          ))}
                        </div>
                      </div>
                      <div className="w-3/4 h-2 bg-white/20 rounded-full mb-4"></div>
                      <span className="text-xs font-bold text-fuchsia-400 tracking-widest uppercase animate-pulse">
                        Playing Video
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-full h-2 bg-white/20 rounded-full mb-2 overflow-hidden">
                        <div className="w-1/3 h-full bg-fuchsia-500 rounded-full"></div>
                      </div>
                      <div className="w-3/4 h-2 bg-white/20 rounded-full mb-4"></div>
                      <span className="text-xs font-bold text-white/70 tracking-widest uppercase">
                        {isGenerated ? `${selectedAvatar.name} Ready` : `${selectedAvatar.name} Selected`}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-64 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-3">
                <button 
                  onClick={togglePlay}
                  disabled={!isGenerated}
                  className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-colors ${isGenerated ? 'bg-white text-black hover:bg-fuchsia-500 hover:text-white cursor-pointer' : 'bg-white/20 text-white/40 cursor-not-allowed'}`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <PlaySquare className="w-4 h-4 ml-0.5" />}
                </button>
                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 bg-fuchsia-500 rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-white/70 font-medium whitespace-nowrap shrink-0">
                  {isGenerated ? (isPlaying ? '01:12' : '02:45') : '00:00'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 relative z-10">
            <Settings2 className="w-5 h-5 text-fuchsia-400" />
            Avatar Settings
          </h2>
          
          <div className="space-y-6 relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
            <div>
              <label className="block text-sm font-medium mb-3 flex justify-between">
                <span>Select Avatar</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {avatars.map((avatar) => (
                  <div 
                    key={avatar.id} 
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`aspect-square rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center overflow-hidden relative shadow-md hover:scale-105 ${selectedAvatar.id === avatar.id ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/30' : 'border-border/50 hover:border-fuchsia-500/50'}`}
                  >
                    <Image src={avatar.src} alt={avatar.name} fill sizes="(max-width: 768px) 33vw, 150px" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Background Style</label>
              <select 
                value={bgStyle}
                onChange={(e) => setBgStyle(e.target.value)}
                className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-fuchsia-500 focus:outline-none transition-all appearance-none font-medium text-sm"
              >
                <option>Transparent (Green Screen)</option>
                <option>Modern Classroom</option>
                <option>Cozy Office</option>
                <option>Gradient Studio</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3 flex justify-between">
                <span>Audio Source</span>
                <span className="text-xs text-muted-foreground">Required</span>
              </label>
              
              {!selectedSavedVoice && !uploadedFile ? (
                <div className="grid grid-cols-2 gap-3">
                  <div 
                    onClick={() => setIsVoiceModalOpen(true)}
                    className="bg-background/50 border border-dashed border-border/70 rounded-xl p-4 text-center cursor-pointer hover:bg-fuchsia-500/10 hover:border-fuchsia-500/50 transition-colors flex flex-col items-center justify-center gap-2 group h-28"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-fuchsia-500/20 transition-colors shrink-0">
                      <Mic className="w-4 h-4 text-muted-foreground group-hover:text-fuchsia-400" />
                    </div>
                    <span className="text-xs font-semibold">Voice Studio</span>
                  </div>
                  
                  <label className="bg-background/50 border border-dashed border-border/70 rounded-xl p-4 text-center cursor-pointer hover:bg-fuchsia-500/10 hover:border-fuchsia-500/50 transition-colors flex flex-col items-center justify-center gap-2 group h-28">
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setUploadedFile(e.target.files[0]);
                          setSelectedSavedVoice(null);
                        }
                      }}
                    />
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-fuchsia-500/20 transition-colors shrink-0">
                      <Upload className="w-4 h-4 text-muted-foreground group-hover:text-fuchsia-400" />
                    </div>
                    <span className="text-xs font-semibold">Upload File</span>
                  </label>
                </div>
              ) : (
                <div className="bg-background/80 border border-fuchsia-500/50 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-full bg-fuchsia-500/20 flex items-center justify-center shrink-0">
                      {selectedSavedVoice ? <Mic className="w-4 h-4 text-fuchsia-500" /> : <Upload className="w-4 h-4 text-fuchsia-500" />}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-bold truncate">
                        {selectedSavedVoice ? selectedSavedVoice.name : uploadedFile?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedSavedVoice ? "Saved Voice Studio AI" : "Local Audio File"}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedSavedVoice(null);
                      setUploadedFile(null);
                    }}
                    className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {isGenerated && generatedVideoUrl ? (
            <div className="flex flex-col gap-3 mt-6">
              <button 
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 relative z-10 text-lg disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isDownloading ? "Downloading..." : "Download Video"}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setIsSaveModalOpen(true)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 relative z-10 text-sm"
                >
                  <Save className="w-4 h-4" />
                  Save to Media Library
                </button>
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || (!selectedSavedVoice && !uploadedFile)}
                  className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative z-10 text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Regenerate
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || (!selectedSavedVoice && !uploadedFile)}
              className="w-full mt-6 bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative z-10 text-lg"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {isGenerating ? "Rendering Video..." : "Generate Video"}
            </button>
          )}
        </div>
      </div>
    </div>

      {/* Voice Selection Modal */}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Mic className="w-5 h-5 text-fuchsia-500" />
                Select from Voice Studio
              </h3>
              <button onClick={() => setIsVoiceModalOpen(false)} className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-background transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {savedVoices.length === 0 ? (
                <div className="text-center py-10">
                  <Mic className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h4 className="text-lg font-medium text-foreground">No saved voices found</h4>
                  <p className="text-muted-foreground mt-2">Go to the Voice Studio to generate and save a voice first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedVoices.map(sv => (
                    <div 
                      key={sv.id}
                      onClick={() => {
                        setSelectedSavedVoice(sv);
                        setUploadedFile(null);
                        setIsVoiceModalOpen(false);
                      }}
                      className="bg-background border border-border/50 hover:border-fuchsia-500/50 p-4 rounded-2xl cursor-pointer hover:bg-fuchsia-500/5 transition-all group flex flex-col h-full"
                    >
                      <h4 className="font-bold group-hover:text-fuchsia-500 transition-colors">{sv.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{sv.voice_preset}</p>
                      <p className="text-sm text-foreground/80 italic border-l-2 border-fuchsia-500/30 pl-2 mt-3 line-clamp-2">
                        "{sv.script_text}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Video Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Video className="w-5 h-5 text-indigo-500" />
                Name your Video
              </h3>
              <button onClick={() => setIsSaveModalOpen(false)} className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-background transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              <input 
                type="text" 
                value={videoName}
                onChange={(e) => setVideoName(e.target.value)}
                placeholder="e.g. Intro for Marketing Course"
                className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                autoFocus
              />
              <button 
                onClick={handleSaveVideo}
                disabled={isSaving || !videoName.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isSaving ? "Saving..." : "Save to Database"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
