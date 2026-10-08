"use client";

import { useState, useEffect } from "react";
import { MonitorPlay, Upload, Loader2, CheckCircle2, AlertCircle, PlaySquare as YoutubeIcon, Save } from "lucide-react";
import { checkYouTubeConnectionAction, connectYouTubeAction } from "@/app/actions/youtube-auth-actions";
import { uploadToYouTubeAction, generateYouTubeScriptAction } from "@/app/actions/youtube-upload-actions";
import { generateVideoAction, checkVideoStatusAction, saveVideoAction } from "@/app/actions/video-actions";
import { toast } from "sonner";

export default function YoutubeGeneratorPage() {
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [privacy, setPrivacy] = useState("private");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const [isSavingToMedia, setIsSavingToMedia] = useState(false);
  const [hasSavedToMedia, setHasSavedToMedia] = useState(false);

  const handleSaveToMedia = async () => {
    if (!generatedVideoUrl) return;
    setIsSavingToMedia(true);
    try {
      const saveRes = await saveVideoAction({
        name: title || "Generated YouTube Video",
        video_url: generatedVideoUrl,
        avatar_name: "AI YouTube Presenter"
      });
      if (saveRes.success) {
        toast.success("Video saved to Media Library!");
        setHasSavedToMedia(true);
      } else {
        throw new Error(saveRes.error || "Failed to save");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save to Media Library.");
    } finally {
      setIsSavingToMedia(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      setErrorMsg("Failed to connect YouTube account.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('success')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const checkStatus = async () => {
      const res = await checkYouTubeConnectionAction();
      setIsConnected(res.connected || false);
      setIsChecking(false);
    };
    checkStatus();
  }, []);

  const handleConnect = async () => {
    await connectYouTubeAction();
  };

  const pollVideoStatus = async (id: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        const res = await checkVideoStatusAction(id);
        if (!res.success) {
          clearInterval(interval);
          reject(new Error(res.error));
        } else if (res.status === "done" && res.videoUrl) {
          clearInterval(interval);
          resolve(res.videoUrl);
        } else if (res.status === "error") {
          clearInterval(interval);
          reject(new Error(res.error_message || "Generation failed"));
        }
      }, 3000);
    });
  };

  const handleGenerateAndUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !title) {
      setErrorMsg("Topic and Title are required.");
      return;
    }
    
    setErrorMsg("");
    setUploadSuccess(false);
    setGeneratedVideoUrl(null);

    try {
      // 1. Generate Script
      setIsGenerating(true);
      toast.info("Generating script with AI...");
      const scriptRes = await generateYouTubeScriptAction(topic);
      if (!scriptRes.success || !scriptRes.script) {
        throw new Error(scriptRes.error || "Failed to generate script");
      }

      // 2. Generate Video with random avatar
      const avatars = [
        "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", // Man in suit
        "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", // Woman 
        "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", // Woman smiling
        "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500"  // Man
      ];
      const randomAvatarUrl = avatars[Math.floor(Math.random() * avatars.length)];
      
      toast.info("Rendering video... This may take a minute.");
      const videoRes = await generateVideoAction(scriptRes.script, randomAvatarUrl);
      if (!videoRes.success || !videoRes.id) {
        throw new Error(videoRes.error || "Failed to generate video");
      }
      setIsGenerating(false);

      // 3. Poll for Completion
      setIsPolling(true);
      const videoUrl = await pollVideoStatus(videoRes.id);
      setGeneratedVideoUrl(videoUrl);
      setIsPolling(false);
      
      toast.success("Video generated successfully!");

      // 4. Upload to YouTube
      setIsUploading(true);
      toast.info("Uploading video to YouTube...");
      
      const uploadRes = await uploadToYouTubeAction({
        title,
        description,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        privacy_status: privacy,
        videoUrl,
      });

      if (!uploadRes.success) {
        throw new Error(uploadRes.error || "Failed to upload");
      }
      
      setUploadSuccess(true);
      toast.success("Video successfully published to YouTube!");
      
      // Reset form
      setTopic("");
      setTitle("");
      setDescription("");
      setTags("");
      setPrivacy("private");
      
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred.");
      toast.error(err.message || "An error occurred.");
      setIsGenerating(false);
      setIsPolling(false);
    } finally {
      setIsUploading(false);
    }
  };

  const isLoading = isGenerating || isPolling || isUploading;

  return (
    <div className="min-h-[85vh] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex flex-col mb-8 gap-2 text-center items-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-2">
          <MonitorPlay className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
          YouTube Video Generator
        </h1>
        <p className="text-muted-foreground mt-1 max-w-lg">
          Generate a 5-10 second engaging short video and automatically upload it directly to your YouTube channel.
        </p>
      </div>

      <div className="w-full max-w-4xl backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-red-500/20 transition-colors duration-500"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {isChecking ? (
          <div className="flex flex-col items-center justify-center py-12 relative z-10">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center justify-center py-12 text-center relative z-10">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border-4 border-red-500/20">
              <YoutubeIcon className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Connect Your YouTube Channel</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              To automatically upload generated videos, you need to link your Google account and grant YouTube upload permissions.
            </p>
            <button 
              onClick={handleConnect}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-red-500/25 flex items-center gap-2"
            >
              <YoutubeIcon className="w-5 h-5" />
              Connect YouTube
            </button>
          </div>
        ) : uploadSuccess ? (
          <div className="flex flex-col items-center justify-center py-12 text-center relative z-10">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border-4 border-green-500/30">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Upload Successful!</h2>
            <p className="text-muted-foreground mb-8">Your video was generated and published to YouTube.</p>
            {generatedVideoUrl && (
              <div className="mb-8 w-full max-w-md aspect-video bg-black rounded-xl overflow-hidden border border-border/50">
                <video src={generatedVideoUrl} controls className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <button 
                onClick={() => {
                  setUploadSuccess(false);
                  setGeneratedVideoUrl(null);
                  setHasSavedToMedia(false);
                }}
                className="bg-background/50 border border-border/50 hover:bg-background px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
              >
                Generate Another Video
              </button>
              <button
                onClick={handleSaveToMedia}
                disabled={isSavingToMedia || hasSavedToMedia}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingToMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {hasSavedToMedia ? "Saved!" : "Save to Media Library"}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10">
            <div className="flex justify-end mb-6">
              <button 
                type="button"
                onClick={handleConnect}
                className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors border border-red-500/20 font-semibold shadow-sm"
              >
                <YoutubeIcon className="w-3.5 h-3.5" />
                Refresh YouTube Connection
              </button>
            </div>
            <form onSubmit={handleGenerateAndUpload} className="space-y-6">
            
            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm mb-2">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
                {errorMsg.toLowerCase().includes("reconnect") && (
                  <button 
                    type="button"
                    onClick={handleConnect}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                  >
                    <YoutubeIcon className="w-4 h-4" />
                    Reconnect YouTube
                  </button>
                )}
              </div>
            )}

            {/* If video generated but currently uploading, show preview */}
            {generatedVideoUrl && (
              <div className="w-full aspect-video max-w-md mx-auto bg-black rounded-xl overflow-hidden border border-border/50 mb-6">
                 <video src={generatedVideoUrl} autoPlay loop muted controls className="w-full h-full object-cover" />
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  Video Topic <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. 3 AI Tools you didn't know about"
                  className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 focus:outline-none transition-all shadow-sm"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  YouTube Title <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="The best AI tools of 2026..."
                  className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 focus:outline-none transition-all shadow-sm"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Description</label>
              <textarea 
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Write your YouTube video description here..."
                className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 focus:outline-none transition-all shadow-sm resize-none"
                disabled={isLoading}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="ai, tools, tech, future"
                  className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 focus:outline-none transition-all shadow-sm"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Privacy Status</label>
                <select 
                  value={privacy}
                  onChange={e => setPrivacy(e.target.value)}
                  className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 focus:outline-none transition-all shadow-sm appearance-none"
                  disabled={isLoading}
                >
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-border/50 flex flex-col gap-4">
              <button 
                type="submit"
                disabled={isLoading}
                className={`w-full text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3 text-lg ${isLoading ? 'bg-red-500/50 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 hover:shadow-red-500/25'}`}
              >
                {isGenerating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Preparing AI Script...</>
                ) : isPolling ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Rendering Video...</>
                ) : isUploading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Uploading to YouTube...</>
                ) : (
                  <><Upload className="w-5 h-5" /> Generate & Upload</>
                )}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Videos are 5-10 seconds long. By clicking this, you agree to our terms of AI generation.
              </p>
            </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
