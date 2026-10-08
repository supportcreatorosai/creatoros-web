"use client"

import { useState } from "react";
import { Sparkles, Save, BookOpen, Loader2, CheckCircle, Download, Video, X } from "lucide-react";
import { generateLessonAction, saveLessonAction, getLessonByIdAction } from "@/app/actions/ai-actions";
import { generateVideoAction, checkVideoStatusAction } from "@/app/actions/video-actions";
import { GeneratedLesson } from "@/lib/ai/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Suspense } from "react";

function LessonGeneratorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [additional, setAdditional] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedLesson | null>(null);
  const [providerInfo, setProviderInfo] = useState<{ provider: string; model: string; duration: number } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isEdited, setIsEdited] = useState(false);

  // Video generation state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (lessonId) {
      const loadLesson = async () => {
        setLoading(true);
        const res = await getLessonByIdAction(lessonId);
        if (res.success && res.lesson) {
          setTopic(res.lesson.topic || res.lesson.title || "");
          setSubject("Loaded from Library");
          setAudience("Loaded from Library");
          try {
            const parsed = JSON.parse(res.lesson.script);
            setResult(parsed);
            setSaved(true);
          } catch(e) {
            console.error("Failed to parse script", e);
          }
        } else {
          setError("Failed to load lesson from library.");
        }
        setLoading(false);
      };
      loadLesson();
    }
  }, [lessonId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (result && isEdited) {
      if (!window.confirm("This will replace your current draft. Continue?")) {
        return;
      }
    }
    if (!topic || !audience || !subject) {
      setError("Please fill out Topic, Class/Audience, and Subject.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProviderInfo(null);
    setSaved(false);
    setSaveError(null);
    setIsEdited(false);

    const response = await generateLessonAction({
      topic,
      audience,
      subject,
      difficulty,
      additionalInstructions: additional,
    });

    if (response.success && response.data) {
      setResult(response.data);
      if (response.providerInfo) {
        setProviderInfo(response.providerInfo);
      }
    } else {
      setError(response.error || "Generation failed.");
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    
    const response = await saveLessonAction(result, topic);
    
    if (response.success) {
      setSaved(true);
    } else {
      setSaveError(response.error || "Failed to save lesson.");
    }
    setSaving(false);
  };

  const handleConvertToVideo = async () => {
    if (!result || !result.summary) {
      alert("Lesson summary is required to generate a video.");
      return;
    }

    setIsVideoModalOpen(true);
    setIsGeneratingVideo(true);
    setVideoStatus("Initializing...");
    setVideoUrl(null);

    // Let D-ID use its default presenter avatar (clean background).
    // To use a custom avatar, provide a direct public URL to a .jpg/.png image.
    const res = await generateVideoAction(result.summary);

    if (!res.success || !res.id) {
      setVideoStatus("Failed to start video generation: " + res.error);
      setIsGeneratingVideo(false);
      return;
    }

    const videoId = res.id;
    setVideoStatus("Generating video (this may take a minute)...");

    const pollInterval = setInterval(async () => {
      const statusRes = await checkVideoStatusAction(videoId);
      if (statusRes.success) {
        if (statusRes.status === "done" && statusRes.videoUrl) {
          clearInterval(pollInterval);
          setVideoUrl(statusRes.videoUrl);
          setVideoStatus(null);
          setIsGeneratingVideo(false);
        } else if (statusRes.status === "error") {
          clearInterval(pollInterval);
          setVideoStatus("Video generation failed on provider.");
          setIsGeneratingVideo(false);
        } else {
          setVideoStatus(`Status: ${statusRes.status}...`);
        }
      } else {
        clearInterval(pollInterval);
        setVideoStatus("Error checking status: " + statusRes.error);
        setIsGeneratingVideo(false);
      }
    }, 5000);
  };

  const handleDownloadPdf = async () => {
    if (!result) return;
    
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    
    const doc = new jsPDF();
    let yPos = 20;

    // Title
    doc.setFontSize(22);
    doc.text(result.title, 14, yPos);
    yPos += 10;
    
    // Introduction
    doc.setFontSize(12);
    const splitIntro = doc.splitTextToSize(result.introduction, 180);
    doc.text(splitIntro, 14, yPos);
    yPos += splitIntro.length * 7 + 10;

    // Learning Objectives
    if (result.learningObjectives && result.learningObjectives.length > 0) {
      doc.setFontSize(16);
      doc.text("Learning Objectives", 14, yPos);
      yPos += 8;
      doc.setFontSize(12);
      const objectives = result.learningObjectives.map(obj => [`• ${obj}`]);
      autoTable(doc, {
        startY: yPos,
        body: objectives,
        theme: 'plain',
        styles: { fontSize: 12, cellPadding: 2 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Sections
    if (result.sections && result.sections.length > 0) {
      result.sections.forEach((sec) => {
        if (yPos > 270) { doc.addPage(); yPos = 20; }
        doc.setFontSize(16);
        doc.text(sec.heading, 14, yPos);
        yPos += 8;
        
        doc.setFontSize(12);
        const splitContent = doc.splitTextToSize(sec.content, 180);
        
        if (yPos + splitContent.length * 7 > 280) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(splitContent, 14, yPos);
        yPos += splitContent.length * 7 + 10;
      });
    }

    // Key Points and other array fields
    const addListSection = (title: string, items: string[] | undefined) => {
      if (items && items.length > 0) {
        if (yPos > 260) { doc.addPage(); yPos = 20; }
        doc.setFontSize(16);
        doc.text(title, 14, yPos);
        yPos += 8;
        autoTable(doc, {
          startY: yPos,
          body: items.map(item => [`• ${item}`]),
          theme: 'plain',
          styles: { fontSize: 12, cellPadding: 2 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
    };

    addListSection("Examples", result.examples);
    addListSection("Key Points", result.keyPoints);
    addListSection("Assessment Questions", result.questions);
    addListSection("Teaching Tips", result.teachingTips);

    // Summary
    if (result.summary) {
      if (yPos > 260) { doc.addPage(); yPos = 20; }
      doc.setFontSize(16);
      doc.text("Summary", 14, yPos);
      yPos += 8;
      doc.setFontSize(12);
      doc.setFont("helvetica", "italic");
      const splitSummary = doc.splitTextToSize(result.summary, 180);
      doc.text(splitSummary, 14, yPos);
      doc.setFont("helvetica", "normal");
      yPos += splitSummary.length * 7 + 10;
    }

    // Footer - Powered by CreatorOS
    doc.setFontSize(10);
    doc.setTextColor(150);
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text("Powered by CreatorOS", doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
    }

    doc.save(`${result.title.replace(/[^a-zA-Z0-9]/g, '_')}_Lesson.pdf`);
  };

  return (
    <div className="min-h-[85vh] p-4 md:p-8 flex flex-col items-center">
      
      <div className="w-full max-w-6xl mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-3 flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 text-indigo-500" />
          AI Lesson Generator
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Create structured, engaging, and high-quality educational lessons in seconds.
        </p>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Configuration */}
        <div className="lg:col-span-4 backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          {/* Glassmorphism subtle glow */}
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Configuration
          </h2>

          <form onSubmit={handleGenerate} className="space-y-4 relative z-10">
            <div>
              <label className="block text-sm font-medium mb-1">Topic *</label>
              <input 
                value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Photosynthesis"
                className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Class / Audience *</label>
              <input 
                value={audience} onChange={e => setAudience(e.target.value)}
                placeholder="e.g. 10th Grade Students"
                className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject *</label>
                <input 
                  value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Biology"
                  className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Difficulty</label>
                <select 
                  value={difficulty} onChange={e => setDifficulty(e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all appearance-none"
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                  <option>Expert</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Additional Instructions</label>
              <textarea 
                value={additional} onChange={e => setAdditional(e.target.value)}
                placeholder="Any specific focus or rules..."
                className="w-full bg-background/50 border border-border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all min-h-[80px]"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? "Generating Lesson..." : result ? "Regenerate Lesson" : "Generate Lesson"}
            </button>
          </form>
        </div>

        {/* Right Side: Results */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="flex-1 backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden min-h-[500px] flex flex-col">
            
            {/* Glassmorphism subtle glow */}
            <div className="absolute top-1/2 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>

            <div className="flex justify-between items-center mb-6 relative z-10 border-b border-border/50 pb-4">
              <h2 className="text-2xl font-bold">Generated Lesson</h2>
              
              {result && (
                <div className="flex gap-2">
                  <button 
                    onClick={handleConvertToVideo}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-fuchsia-500/10 text-fuchsia-500 hover:bg-fuchsia-500/20"
                  >
                    <Video className="w-4 h-4" />
                    Convert to Video
                  </button>
                  <button 
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={saving || saved}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${saved ? 'bg-green-500/20 text-green-400' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saved ? "Saved to Media Library" : "Save to Media Library"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
              {loading && (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground animate-pulse gap-4">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
                  <p>Orchestrating AI generation...</p>
                </div>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 flex items-start gap-3">
                  <div className="mt-0.5">⚠️</div>
                  <p>{error}</p>
                </div>
              )}
              
              {saveError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 mb-4 flex items-start gap-3">
                  <div className="mt-0.5">⚠️</div>
                  <p>{saveError}</p>
                </div>
              )}

              {!loading && !result && !error && (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 text-center">
                  <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                  <p>Your generated lesson will appear here.</p>
                  <p className="text-sm mt-2">Fill out the configuration on the left to get started.</p>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center space-y-4">
                    <input 
                      className="text-3xl font-extrabold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-indigo-500 focus:outline-none w-full text-center transition-colors" 
                      value={result.title} 
                      onChange={(e) => { setResult({...result, title: e.target.value}); setIsEdited(true); }}
                    />
                    <textarea 
                      className="text-lg text-muted-foreground leading-relaxed bg-transparent border border-transparent hover:border-border focus:border-indigo-500 focus:outline-none w-full text-center resize-none rounded-md transition-colors custom-scrollbar" 
                      rows={3}
                      value={result.introduction}
                      onChange={(e) => { setResult({...result, introduction: e.target.value}); setIsEdited(true); }}
                    />
                  </div>

                  {result.learningObjectives && result.learningObjectives.length > 0 && (
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6">
                      <h4 className="text-xl font-bold mb-4 text-indigo-400">🎯 Learning Objectives</h4>
                      <textarea 
                        className="w-full bg-transparent border border-transparent hover:border-border focus:border-indigo-500 focus:outline-none rounded-md resize-y min-h-[100px] text-foreground/80 transition-colors custom-scrollbar"
                        value={result.learningObjectives.join('\n')}
                        onChange={(e) => { setResult({...result, learningObjectives: e.target.value.split('\n')}); setIsEdited(true); }}
                      />
                    </div>
                  )}

                  <div className="space-y-6">
                    {result.sections?.map((section, i) => (
                      <div key={i} className="border-l-4 border-indigo-500/30 pl-6 py-2">
                        <input 
                          className="text-2xl font-bold mb-3 bg-transparent border-b border-transparent hover:border-border focus:border-indigo-500 focus:outline-none w-full transition-colors"
                          value={section.heading}
                          onChange={(e) => {
                            const newSections = [...result.sections];
                            newSections[i].heading = e.target.value;
                            setResult({...result, sections: newSections});
                            setIsEdited(true);
                          }}
                        />
                        <textarea 
                          className="w-full text-foreground/80 leading-relaxed bg-transparent border border-transparent hover:border-border focus:border-indigo-500 focus:outline-none resize-y min-h-[150px] rounded-md transition-colors custom-scrollbar"
                          value={section.content}
                          onChange={(e) => {
                            const newSections = [...result.sections];
                            newSections[i].content = e.target.value;
                            setResult({...result, sections: newSections});
                            setIsEdited(true);
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {result.examples && result.examples.length > 0 && (
                    <div className="bg-muted/30 rounded-2xl p-6">
                      <h4 className="text-xl font-bold mb-4">💡 Examples</h4>
                      <textarea 
                        className="w-full bg-transparent border border-transparent hover:border-border focus:border-indigo-500 focus:outline-none rounded-md resize-y min-h-[100px] text-foreground/80 transition-colors custom-scrollbar"
                        value={result.examples.join('\n')}
                        onChange={(e) => { setResult({...result, examples: e.target.value.split('\n')}); setIsEdited(true); }}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result.keyPoints && result.keyPoints.length > 0 && (
                      <div className="border border-border/50 rounded-2xl p-5 bg-background/50 flex flex-col">
                        <h4 className="font-bold mb-3">🔑 Key Points</h4>
                        <textarea 
                          className="flex-1 w-full text-sm text-foreground/80 bg-transparent border border-transparent hover:border-border focus:border-indigo-500 focus:outline-none resize-y min-h-[100px] rounded-md transition-colors custom-scrollbar"
                          value={result.keyPoints.join('\n')}
                          onChange={(e) => { setResult({...result, keyPoints: e.target.value.split('\n')}); setIsEdited(true); }}
                        />
                      </div>
                    )}
                    
                    {result.questions && result.questions.length > 0 && (
                      <div className="border border-border/50 rounded-2xl p-5 bg-background/50 flex flex-col">
                        <h4 className="font-bold mb-3">❓ Assessment Questions</h4>
                        <textarea 
                          className="flex-1 w-full text-sm text-foreground/80 bg-transparent border border-transparent hover:border-border focus:border-indigo-500 focus:outline-none resize-y min-h-[100px] rounded-md transition-colors custom-scrollbar"
                          value={result.questions.join('\n')}
                          onChange={(e) => { setResult({...result, questions: e.target.value.split('\n')}); setIsEdited(true); }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-center pt-6 border-t border-border/50">
                    <textarea 
                      className="text-muted-foreground italic w-full max-w-2xl mx-auto bg-transparent border border-transparent hover:border-border focus:border-indigo-500 focus:outline-none text-center resize-y min-h-[80px] rounded-md transition-colors custom-scrollbar"
                      value={result.summary}
                      onChange={(e) => { setResult({...result, summary: e.target.value}); setIsEdited(true); }}
                    />
                  </div>
                  
                  {result.teachingTips && result.teachingTips.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl p-5 text-sm">
                      <h4 className="font-bold mb-2 flex items-center gap-2">👨‍🏫 Teaching Tips</h4>
                      <textarea 
                        className="w-full bg-transparent border border-transparent hover:border-amber-500/50 focus:border-amber-500 focus:outline-none resize-y min-h-[100px] rounded-md transition-colors custom-scrollbar"
                        value={result.teachingTips.join('\n')}
                        onChange={(e) => { setResult({...result, teachingTips: e.target.value.split('\n')}); setIsEdited(true); }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Provider Indicator Footer */}
            {providerInfo && !loading && (
              <div className="mt-6 pt-4 border-t border-border/50 flex justify-end">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/50 border border-border/50 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Powered by CreatorOS
                  <span className="opacity-50">· {providerInfo.duration}ms</span>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Video Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border/50 rounded-3xl p-6 w-full max-w-3xl shadow-2xl relative flex flex-col items-center">
            <button 
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Video className="w-6 h-6 text-fuchsia-500" />
              AI Avatar Video
            </h2>

            <div className="w-full aspect-video bg-black/50 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden shadow-inner relative">
              {isGeneratingVideo && (
                <div className="flex flex-col items-center gap-4 text-fuchsia-400">
                  <Loader2 className="w-10 h-10 animate-spin" />
                  <p className="font-medium animate-pulse">{videoStatus}</p>
                </div>
              )}

              {videoUrl && (
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  className="w-full h-full object-contain" 
                />
              )}

              {!isGeneratingVideo && !videoUrl && videoStatus && (
                <div className="text-destructive font-medium bg-destructive/10 p-4 rounded-xl border border-destructive/20">
                  {videoStatus}
                </div>
              )}
            </div>
            
            {videoUrl && (
              <a 
                href={videoUrl} 
                target="_blank" 
                rel="noreferrer"
                className="mt-6 flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold bg-fuchsia-600 hover:bg-fuchsia-700 text-white transition-all shadow-lg hover:shadow-fuchsia-500/25"
              >
                <Download className="w-4 h-4" />
                Download MP4
              </a>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default function LessonGeneratorPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <LessonGeneratorContent />
    </Suspense>
  );
}
