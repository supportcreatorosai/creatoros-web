"use client";

import { useState, useEffect, useRef } from "react";
import { Image as ImageIcon, Sparkles, Settings2, Download, RefreshCcw, Layers, Loader2, Maximize2, X, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveImageAction } from "@/app/actions/image-actions";

const styles = ['3D Render', 'Cinematic', 'Minimalist', 'Anime / 2D', 'MrBeast Style', 'Vlog'];

export default function ThumbnailGeneratorPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(0); 
  const [title, setTitle] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  
  // This will store the data URL of the final composited image
  const [compositedImages, setCompositedImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Hidden canvas for processing
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cleanPrompt = (rawPrompt: string) => {
    return rawPrompt.replace(/\//g, ' ');
  };

  const compositeImage = async (imageUrl: string, is4k: boolean = false, hueRotate: number = 0, brightness: number = 1): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!canvasRef.current) return reject("No canvas");
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("No 2d context");

        const width = is4k ? 3840 : 1920;
        const height = is4k ? 2160 : 1080;
        
        canvas.width = width;
        canvas.height = height;

        // Apply CSS filters natively to the canvas ctx
        if (hueRotate !== 0 || brightness !== 1) {
          ctx.filter = `hue-rotate(${hueRotate}deg) brightness(${brightness})`;
        } else {
          ctx.filter = 'none';
        }

        // Draw background
        ctx.drawImage(img, 0, 0, width, height);
        
        // Reset filter for text
        ctx.filter = 'none';

        // Draw title if exists
        if (title.trim()) {
           ctx.textAlign = "center";
           ctx.textBaseline = "middle";
           
           const fontSize = is4k ? 240 : 120;
           ctx.font = `900 ${fontSize}px sans-serif`;
           
           ctx.shadowColor = "rgba(0,0,0,0.8)";
           ctx.shadowBlur = is4k ? 30 : 15;
           ctx.shadowOffsetX = 0;
           ctx.shadowOffsetY = is4k ? 8 : 4;
           
           ctx.fillStyle = "white";
           const text = title.toUpperCase();
           
           // Outline stroke for better pop
           ctx.strokeStyle = "rgba(0,0,0,0.9)";
           ctx.lineWidth = is4k ? 20 : 10;
           ctx.strokeText(text, width / 2, height / 2);
           
           // Fill text
           ctx.fillText(text, width / 2, height / 2);
        }

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => reject("Failed to load image into canvas");
      img.src = imageUrl;
    });
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      alert("Please enter a topic first.");
      return;
    }

    setIsGenerating(true);
    setIsGenerated(false);
    setCompositedImages([]);
    setActiveImageIndex(0);

    const styleName = styles[selectedStyle];
    const prompt = cleanPrompt(`${topic}, ${styleName} style, high quality, youtube thumbnail`);
    const seed = Math.floor(Math.random() * 1000000);
    const rawUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1920&height=1080&nologo=true&seed=${seed}`;
    
    // Route through local proxy to bypass CORS and aggressively prevent browser caching
    const proxyUrl = `/api/download?url=${encodeURIComponent(rawUrl)}`;

    try {
      // 1. Fetch raw image via proxy
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to fetch from proxy");
      const blob = await response.blob();
      const localBlobUrl = URL.createObjectURL(blob);

      // 2. Generate multiple variations (hue shifts) via canvas
      const variations = [];
      for (let i = 0; i < 4; i++) {
        const hueRotate = i * 45;
        const brightness = 1 + (i * 0.1);
        const dataUrl = await compositeImage(localBlobUrl, false, hueRotate, brightness);
        variations.push(dataUrl);
      }
      
      URL.revokeObjectURL(localBlobUrl);
      
      setCompositedImages(variations);
      setIsGenerated(true);
    } catch (e) {
      console.error(e);
      alert("Failed to generate image. The AI service might be busy or blocked.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload4k = async () => {
    setIsDownloading(true);
    
    const styleName = styles[selectedStyle];
    const prompt = cleanPrompt(`${topic}, ${styleName} style, high quality, youtube thumbnail`);
    const seed = Math.floor(Math.random() * 1000000);
    const rawUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=3840&height=2160&nologo=true&seed=${seed}`;
    const proxyUrl = `/api/download?url=${encodeURIComponent(rawUrl)}`;

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to fetch 4k image");
      const blob = await response.blob();
      const localBlobUrl = URL.createObjectURL(blob);
      
      // Calculate active variation properties
      const hueRotate = activeImageIndex * 45;
      const brightness = 1 + (activeImageIndex * 0.1);

      const highResDataUrl = await compositeImage(localBlobUrl, true, hueRotate, brightness);
      
      const filename = `creatoros_thumbnail_4k_${new Date().getTime()}.jpg`;
      const a = document.createElement('a');
      a.href = highResDataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(localBlobUrl);
    } catch (e) {
      console.error(e);
      alert("Failed to download 4K image.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveToMediaLibrary = async () => {
    if (!compositedImages[activeImageIndex]) return;
    
    setIsSaving(true);
    // Note: We are passing a Base64 data URL to the server action. 
    // Supabase TEXT column can handle this, and Next.js body limit is configured.
    const res = await saveImageAction({
      name: title || topic || 'Thumbnail',
      image_url: compositedImages[activeImageIndex],
      style: styles[selectedStyle]
    });
    
    setIsSaving(false);
    if (res.success) {
      alert("Saved successfully!");
    } else {
      alert(res.error || "Failed to save image.");
    }
  };

  return (
    <div className="min-h-[85vh] p-4 md:p-8 flex flex-col items-center">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div className="w-full max-w-6xl mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-3 flex items-center justify-center gap-3">
          <ImageIcon className="w-8 h-8 text-blue-500" />
          Thumbnail Generator
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Create high-converting, click-worthy YouTube and social media thumbnails in seconds.
        </p>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 relative z-10">
            <Settings2 className="w-5 h-5 text-blue-400" />
            Generation Settings
          </h2>
          
          <div className="space-y-6 relative z-10 flex-1">
            <div>
              <label className="block text-sm font-medium mb-2">Topic or Concept</label>
              <textarea 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all min-h-[80px]"
                placeholder="A futuristic AI robot teaching mathematics in a neon classroom..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Art Style</label>
              <div className="grid grid-cols-2 gap-3">
                {styles.map((style, i) => (
                  <div 
                    key={i} 
                    onClick={() => setSelectedStyle(i)}
                    className={`px-3 py-2 text-center text-sm font-medium rounded-lg border cursor-pointer transition-all ${selectedStyle === i ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-background/50 border-border/50 hover:bg-background'}`}
                  >
                    {style}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Title Text (Optional)</label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                placeholder="E.g., HOW AI WILL CHANGE EVERYTHING"
              />
            </div>
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative z-10"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {isGenerating ? "Generating..." : "Generate Thumbnails"}
          </button>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col min-h-[400px]">
            <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-400" />
                Primary Result
              </h2>
              <div className="flex gap-2">
                <button 
                  disabled={!isGenerated}
                  onClick={handleGenerate}
                  className="p-2 rounded-lg bg-background/50 border border-border/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  title="Regenerate all"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  disabled={!isGenerated}
                  className="p-2 rounded-lg bg-background/50 border border-border/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  title="Enlarge Image"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button 
                  disabled={!isGenerated || isDownloading || isSaving}
                  onClick={handleSaveToMediaLibrary}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-all bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-sm"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save to Library
                </button>
                <button 
                  disabled={!isGenerated || isDownloading}
                  onClick={handleDownload4k}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-sm"
                >
                  {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isDownloading ? "Generating 4K..." : "Download 4K"}
                </button>
              </div>
            </div>

            <div 
              className={`flex-1 rounded-2xl border ${isGenerated ? 'border-blue-500/50' : 'border-white/10'} relative overflow-hidden flex items-center justify-center bg-black/40 group cursor-pointer transition-colors`}
              onClick={() => isGenerated && setIsModalOpen(true)}
            >
              {isGenerating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 opacity-90 animate-pulse">
                  <Loader2 className="w-16 h-16 text-blue-500 mb-4 animate-spin" />
                  <span className="text-blue-400 tracking-widest font-semibold uppercase text-sm">Rendering Image Engine (Takes ~10s)...</span>
                </div>
              )}
              
              {isGenerated && compositedImages[activeImageIndex] && (
                <>
                  <img 
                    src={compositedImages[activeImageIndex]} 
                    alt="Generated Thumbnail" 
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-700 opacity-100 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                    <span className="text-white font-medium flex items-center gap-2"><Maximize2 className="w-4 h-4" /> Click to enlarge</span>
                  </div>
                </>
              )}
              
              {!isGenerating && !isGenerated && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/40 via-indigo-900/20 to-purple-900/40"></div>
                  <div className="relative z-10 flex flex-col items-center opacity-60 group-hover:scale-105 transition-transform duration-500">
                    <Layers className="w-16 h-16 text-white/30 mb-4" />
                    <span className="text-white/50 tracking-widest font-semibold uppercase text-sm">1920x1080 Output</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-xl">
            <h3 className="text-sm font-bold mb-4 text-muted-foreground uppercase tracking-wider">Variations</h3>
            <div className="grid grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  onClick={() => isGenerated && setActiveImageIndex(i)}
                  className={`aspect-video rounded-xl bg-black/40 border flex items-center justify-center transition-all cursor-pointer relative overflow-hidden group ${activeImageIndex === i ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-border/50 hover:border-blue-500/50'}`}
                >
                  {isGenerated && compositedImages[i] ? (
                    <img 
                      src={compositedImages[i]} 
                      alt={`Variation ${i + 1}`} 
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity ${activeImageIndex === i ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent"></div>
                      <ImageIcon className="w-6 h-6 text-white/20 group-hover:text-blue-400 transition-colors" />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Enlarged Image Modal */}
      {isModalOpen && isGenerated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-7xl max-h-[90vh] flex flex-col items-center">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-black/50">
              <img 
                src={compositedImages[activeImageIndex]} 
                alt="Enlarged Thumbnail" 
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
            <div className="mt-6">
              <button 
                onClick={handleDownload4k}
                disabled={isDownloading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25 text-lg disabled:opacity-70"
              >
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isDownloading ? "Generating 4K..." : "Download High-Res 4K"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
