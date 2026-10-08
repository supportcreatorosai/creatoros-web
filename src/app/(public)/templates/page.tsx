"use client"

import { useState } from "react"
import { AuthModal } from "@/components/auth-modal"
import { BookOpen, Mic, Image as ImageIcon, Video, Calendar, Sparkles, ArrowRight } from "lucide-react"
import { CtaSection } from "@/components/cta-section"

const templates = [
  {
    id: "lesson-plan",
    title: "Lesson Generator",
    description: "Generate comprehensive educational lesson plans, learning objectives, activities, and assessments.",
    icon: <BookOpen className="h-6 w-6" />,
    gradient: "from-indigo-500 to-blue-600",
    bgGlow: "bg-indigo-500/20",
    badge: "Popular",
  },
  {
    id: "video-script",
    title: "Video Script",
    description: "Create engaging scripts for YouTube, TikTok, or Instagram Reels with hooks and calls-to-action.",
    icon: <Video className="h-6 w-6" />,
    gradient: "from-violet-500 to-purple-600",
    bgGlow: "bg-violet-500/20",
  },
  {
    id: "voiceover",
    title: "AI Voiceover",
    description: "Convert your text into lifelike speech with emotion control and multiple voice styles.",
    icon: <Mic className="h-6 w-6" />,
    gradient: "from-fuchsia-500 to-pink-600",
    bgGlow: "bg-fuchsia-500/20",
  },
  {
    id: "thumbnail",
    title: "Thumbnail Generator",
    description: "Design eye-catching thumbnails optimized for high click-through rates on any platform.",
    icon: <ImageIcon className="h-6 w-6" />,
    gradient: "from-blue-500 to-cyan-600",
    bgGlow: "bg-blue-500/20",
  },
  {
    id: "social-post",
    title: "Social Media Post",
    description: "Craft engaging Twitter threads, LinkedIn posts, and Facebook updates that drive engagement.",
    icon: <Sparkles className="h-6 w-6" />,
    gradient: "from-emerald-500 to-teal-600",
    bgGlow: "bg-emerald-500/20",
  },
  {
    id: "content-calendar",
    title: "Content Calendar",
    description: "Plan and organize your upcoming content strategy for the entire week or month.",
    icon: <Calendar className="h-6 w-6" />,
    gradient: "from-amber-500 to-orange-600",
    bgGlow: "bg-amber-500/20",
  },
]

export default function TemplatesPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative w-full pt-20 pb-16 md:pt-28 md:pb-20 overflow-hidden">
        <div className="absolute inset-0 w-full h-full bg-background z-[-2]"></div>
        <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))] z-[-1]"></div>
        
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center space-y-4 text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              AI-Powered Templates
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground">
              What will you <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-500">create</span> today?
            </h1>
            <p className="mx-auto max-w-[650px] text-muted-foreground md:text-xl leading-relaxed">
              Choose from our collection of AI-powered templates and start building amazing content in seconds.
            </p>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {templates.map((template, index) => (
              <div 
                key={template.id} 
                className="group relative rounded-xl glass-card overflow-hidden flex flex-col"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Glow effect on hover */}
                <div className={`absolute inset-0 ${template.bgGlow} opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-500 -z-10`} />
                
                <div className="p-6 flex flex-col flex-1">
                  {/* Icon & Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${template.gradient} text-white shadow-lg`}>
                      {template.icon}
                    </div>
                    {template.badge && (
                      <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                        {template.badge}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-foreground mb-2">{template.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">{template.description}</p>

                  {/* CTA */}
                  <button 
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-sm font-medium transition-all duration-300 group/btn"
                  >
                    Start Creating
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection />
      
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </div>
  )
}
