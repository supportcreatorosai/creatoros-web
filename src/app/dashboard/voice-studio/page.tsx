"use client";

import { useState, useEffect } from "react";
import { Mic, Play, Pause, Volume2, Settings2, Sparkles, Wand2, Loader2, Save, Trash2, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveVoiceAction, getSavedVoicesAction, deleteVoiceAction, SavedVoice } from "@/app/actions/voice-actions";
import Link from "next/link";

const voices = [
  { name: 'Marcus', desc: 'Deep (US)', lang: 'en-US', gender: 'male', matchNames: ['Google US English', 'Microsoft Guy', 'Alex'] },
  { name: 'Sarah', desc: 'Energetic (US)', lang: 'en-US', gender: 'female', matchNames: ['Google US English', 'Microsoft Zira', 'Samantha', 'Victoria'] },
  { name: 'James', desc: 'Calm (UK)', lang: 'en-GB', gender: 'male', matchNames: ['Google UK English Male', 'Microsoft George', 'Daniel'] },
  { name: 'Elena', desc: 'Professional (UK)', lang: 'en-GB', gender: 'female', matchNames: ['Google UK English Female', 'Microsoft Hazel', 'Serena'] },
  { name: 'Raj', desc: 'Indian Male', lang: 'en-IN', gender: 'male', matchNames: ['Google UK English Male', 'Microsoft Ravi', 'Rishi'] },
  { name: 'Priya', desc: 'Indian Female', lang: 'en-IN', gender: 'female', matchNames: ['Google UK English Female', 'Microsoft Heera', 'Veena'] }
];

const getMatchingVoice = (preset: typeof voices[0], availableVoices: SpeechSynthesisVoice[]) => {
  if (availableVoices.length === 0) return null;
  
  // 1. Try exact name matches first
  for (const matchName of preset.matchNames) {
    const found = availableVoices.find(v => v.name.includes(matchName));
    if (found) return found;
  }
  
  // 2. Try language matches
  const langVoices = availableVoices.filter(v => v.lang.startsWith(preset.lang) || v.lang.startsWith(preset.lang.replace('-', '_')));
  if (langVoices.length > 0) {
    const index = preset.gender === 'female' ? Math.min(1, langVoices.length - 1) : 0;
    return langVoices[index];
  }
  
  // 3. Fallback to first available
  return availableVoices[0];
};

export default function VoiceStudioPage() {
  const router = useRouter();
  const [selectedVoice, setSelectedVoice] = useState(0);
  const [speed, setSpeed] = useState("1.0");
  const [scriptText, setScriptText] = useState("Welcome to today's lesson on artificial intelligence! Today, we're going to dive deep into how neural networks learn from data...");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isImproving, setIsImproving] = useState(false);
  const [tone, setTone] = useState("Engaged & Excited");
  
  // Save voice state
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Modals state
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempVoiceName, setTempVoiceName] = useState("");
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  
  // Fetch saved voices on mount
  useEffect(() => {
    fetchSavedVoices();
  }, []);

  const fetchSavedVoices = async () => {
    const res = await getSavedVoicesAction();
    if (res.success && res.voices) {
      setSavedVoices(res.voices);
    }
  };
  
  // Calculate dynamic duration based on word count and speed
  const wordCount = scriptText.trim() === "" ? 0 : scriptText.trim().split(/\s+/).length;
  const durationSeconds = Math.max(Math.floor(wordCount / (2.5 * parseFloat(speed))), 1);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      const updateIntervalMs = 50;
      const totalSteps = (durationSeconds * 1000) / updateIntervalMs;
      const increment = 100 / totalSteps;

      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return p + increment;
        });
      }, updateIntervalMs);
    }
    return () => clearInterval(interval);
  }, [isPlaying, durationSeconds]);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const handleImproveScript = () => {
    setIsImproving(true);
    setTimeout(() => {
      setScriptText(prev => prev + " This advanced capability opens up entirely new possibilities for automation and creativity in the digital age.");
      setIsImproving(false);
      setIsGenerated(false);
    }, 1500);
  };

  const handleGenerate = () => {
    if (scriptText.trim().length === 0) return;
    setIsGenerating(true);
    setIsGenerated(false);
    setProgress(0);
    setIsPlaying(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    
    setTimeout(() => {
      setIsGenerating(false);
      setIsGenerated(true);
    }, 2000);
  };

  const togglePlay = () => {
    if (!isGenerated) return;
    
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      if (progress >= 100) setProgress(0);
      
      const utterance = new SpeechSynthesisUtterance(scriptText);
      utterance.rate = parseFloat(speed);
      
      const availableVoices = window.speechSynthesis.getVoices();
      const preset = voices[selectedVoice % voices.length];
      const matchedVoice = getMatchingVoice(preset, availableVoices);
      
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      
      utterance.onend = () => {
        setIsPlaying(false);
        setProgress(100);
      };
      utterance.onerror = () => setIsPlaying(false);
      
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
  };

  const handleSaveVoice = async () => {
    if (!tempVoiceName || tempVoiceName.trim() === "") return;
    
    setIsSaving(true);
    const res = await saveVoiceAction({
      name: tempVoiceName.trim(),
      script_text: scriptText,
      voice_preset: `${voices[selectedVoice % voices.length].name} (${voices[selectedVoice % voices.length].desc})`,
      tone: tone,
      speed: parseFloat(speed),
    });
    
    setIsSaving(false);
    if (res.success) {
      setIsNameModalOpen(false);
      setTempVoiceName("");
      fetchSavedVoices();
    } else {
      alert(res.error || "Failed to save voice");
    }
  };

  const handleDeleteVoice = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this voice?")) return;
    setIsDeleting(id);
    const res = await deleteVoiceAction(id);
    setIsDeleting(null);
    if (res.success) {
      fetchSavedVoices();
    } else {
      alert(res.error || "Failed to delete voice");
    }
  };
  
  const playSavedVoice = (voice: SavedVoice) => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(voice.script_text);
    utterance.rate = voice.speed;
    const availableVoices = window.speechSynthesis.getVoices();
    const preset = voices.find(v => voice.voice_preset.includes(v.name)) || voices[0];
    const matchedVoice = getMatchingVoice(preset, availableVoices);
    
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-[85vh] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-3 flex items-center justify-center gap-3">
          <Mic className="w-8 h-8 text-violet-500" />
          AI Voice Studio
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Generate studio-quality voiceovers from your scripts with emotional intelligence.
        </p>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 relative z-10">
            <Settings2 className="w-5 h-5 text-violet-400" />
            Voice Settings
          </h2>
          
          <div className="space-y-6 relative z-10 flex-1">
            <div>
              <label className="block text-sm font-medium mb-3">Select Voice</label>
              <div className="grid grid-cols-2 gap-3">
                {voices.map((voice, i) => (
                  <div 
                    key={i} 
                    onClick={() => {
                      setSelectedVoice(i);
                      setIsGenerated(false);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedVoice === i ? 'bg-violet-500/20 border-violet-500/50' : 'bg-background/50 border-border/50 hover:bg-background'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-muted overflow-hidden flex items-center justify-center text-[10px]">👤</div>
                      <span className="text-sm font-medium truncate">{voice.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{voice.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Emotion / Tone</label>
              <select 
                value={tone}
                className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-violet-500 focus:outline-none transition-all appearance-none"
                onChange={(e) => {
                  setTone(e.target.value);
                  setIsGenerated(false);
                }}
              >
                <option value="Engaged & Excited">Engaged & Excited</option>
                <option value="Serious & Educational">Serious & Educational</option>
                <option value="Soft & Calming">Soft & Calming</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex justify-between">
                <span>Speed</span>
                <span className="text-muted-foreground">{speed}x</span>
              </label>
              <input 
                type="range" min="0.5" max="2" step="0.1" value={speed} 
                onChange={(e) => {
                  setSpeed(e.target.value);
                  setIsGenerated(false);
                }} 
                className="w-full accent-violet-500" 
              />
            </div>
          </div>
          
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || scriptText.trim() === ""}
            className="w-full mt-6 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-violet-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative z-10"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {isGenerating ? "Generating..." : "Generate Audio"}
          </button>
        </div>

        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="flex-1 backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col">
            <div className="absolute top-1/2 right-0 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
            
            <div className="flex justify-between items-center mb-6 relative z-10 border-b border-border/50 pb-4">
              <h2 className="text-xl font-bold">Script Editor</h2>
              <button 
                onClick={handleImproveScript}
                disabled={isImproving || scriptText.trim() === ""}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 text-sm"
              >
                {isImproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {isImproving ? "Improving..." : "Improve with AI"}
              </button>
            </div>

            <textarea 
              value={scriptText}
              onChange={(e) => {
                setScriptText(e.target.value);
                setIsGenerated(false);
              }}
              className="flex-1 w-full bg-transparent border-none focus:outline-none resize-none text-lg text-foreground/90 leading-relaxed custom-scrollbar relative z-10"
              placeholder="Paste your script here, or select a lesson from your library to automatically import the script..."
            />

            <div className="mt-6 p-4 rounded-2xl bg-background/60 border border-border/50 flex items-center gap-4 relative z-10">
              <button 
                onClick={togglePlay}
                disabled={!isGenerated}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors shadow-lg ${isGenerated ? 'bg-violet-600 hover:bg-violet-700 cursor-pointer' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
              </button>
              
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium w-8">
                  {isGenerated ? formatTime(Math.floor((progress / 100) * durationSeconds)) : "0:00"}
                </span>
                <div className="flex-1 h-8 flex items-center gap-1 opacity-50 relative">
                  <div 
                    className="absolute inset-y-0 left-0 bg-violet-500/20 z-0 rounded-l-md transition-all ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                  {[20, 45, 80, 30, 90, 60, 20, 40, 75, 50, 85, 30, 40, 90, 60, 20, 80, 50, 40, 70, 30, 85, 60, 40, 20, 75, 90, 45, 30, 80, 50, 70, 40, 20, 60, 85, 30, 40, 75, 50].map((h, i) => (
                    <div 
                      key={i} 
                      className={`flex-1 rounded-full relative z-10 transition-colors ${progress > (i / 40) * 100 ? 'bg-violet-500' : 'bg-violet-500/30'}`} 
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground font-medium w-8">
                  {isGenerated ? formatTime(durationSeconds) : "--:--"}
                </span>
              </div>

              <button className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                <Volume2 className="w-4 h-4" />
              </button>

              {isGenerated && (
                <button 
                  onClick={() => setIsNameModalOpen(true)}
                  disabled={isSaving}
                  className="ml-2 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-violet-600 hover:bg-violet-700 text-white text-sm"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Voice
                </button>
              )}
            </div>
            
            {savedVoices.length > 0 && (
              <div className="mt-8 pt-6 border-t border-border/50 relative z-10">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-violet-400" />
                  My Saved Voices
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedVoices.map(sv => (
                    <div key={sv.id} className="bg-background/50 border border-border/50 p-4 rounded-2xl flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold">{sv.name}</h4>
                          <p className="text-xs text-muted-foreground">{sv.voice_preset} • {sv.speed}x</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => playSavedVoice(sv)}
                            className="p-2 rounded-full bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 transition-colors"
                          >
                            <Play className="w-3 h-3 ml-0.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteVoice(sv.id)}
                            disabled={isDeleting === sv.id}
                            className="p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                          >
                            {isDeleting === sv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80 italic border-l-2 border-violet-500/30 pl-2">
                        {sv.script_text.trim().split(/\s+/).length > 8 ? (
                          <>
                            "{sv.script_text.trim().split(/\s+/).slice(0, 8).join(" ")}..."
                            <button 
                              onClick={() => setExpandedScript(sv.script_text)}
                              className="text-violet-500 font-medium text-xs ml-2 hover:underline focus:outline-none"
                            >
                              More
                            </button>
                          </>
                        ) : (
                          `"${sv.script_text}"`
                        )}
                      </p>
                      <Link 
                        href="/dashboard/lesson-generator" 
                        className="mt-2 flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors"
                      >
                        <Video className="w-3 h-3" />
                        Use in Avatar Video
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>

      {/* Name Modal */}
      {isNameModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsNameModalOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-4">Name your voice</h3>
            <input 
              type="text" 
              value={tempVoiceName}
              onChange={(e) => setTempVoiceName(e.target.value)}
              placeholder="e.g. My Intro Welcome"
              className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:outline-none mb-6"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsNameModalOpen(false)}
                className="px-4 py-2 rounded-lg font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveVoice}
                disabled={!tempVoiceName.trim() || isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save to Media Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Script Modal */}
      {expandedScript && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl p-6 relative max-h-[80vh] flex flex-col">
            <button onClick={() => setExpandedScript(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-4">Full Script</h3>
            <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar text-foreground/90 leading-relaxed italic border-l-4 border-violet-500/50 pl-4 bg-muted/30 p-4 rounded-r-xl">
              "{expandedScript}"
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
