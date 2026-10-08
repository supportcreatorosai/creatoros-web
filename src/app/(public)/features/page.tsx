import { Type, Mic, User, Image as ImageIcon, Sparkles, Zap, LayoutDashboard, Share2, Layers } from "lucide-react";
import { CtaSection } from "@/components/cta-section";

export const metadata = {
  title: "Features | CreatorOS AI",
  description: "Explore the powerful AI tools built into CreatorOS to generate, edit, and publish educational content.",
};

const features = [
  {
    icon: <Type className="h-6 w-6 text-indigo-400" />,
    title: "AI Script Generation",
    description: "Turn a simple topic or keyword into a fully-structured, engaging educational script in seconds. Customized for different formats and audience levels.",
    color: "bg-indigo-500/10 border-indigo-500/20",
  },
  {
    icon: <Mic className="h-6 w-6 text-violet-400" />,
    title: "Lifelike Voiceovers",
    description: "Generate professional voiceovers with our advanced text-to-speech models. Choose from hundreds of diverse voices with adjustable pacing and emotion.",
    color: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: <User className="h-6 w-6 text-fuchsia-400" />,
    title: "Talking Avatars",
    description: "Bring your lessons to life with AI-generated human avatars. Create high-quality talking head videos without needing a camera or studio.",
    color: "bg-fuchsia-500/10 border-fuchsia-500/20",
  },
  {
    icon: <ImageIcon className="h-6 w-6 text-blue-400" />,
    title: "Dynamic Thumbnails",
    description: "Automatically generate eye-catching thumbnails optimized for click-through rates on YouTube, Instagram, and other platforms.",
    color: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: <Layers className="h-6 w-6 text-emerald-400" />,
    title: "Smart Captions",
    description: "Auto-generate highly accurate, animated captions for your videos to increase retention and accessibility across social feeds.",
    color: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: <Share2 className="h-6 w-6 text-amber-400" />,
    title: "Auto-Publishing",
    description: "Schedule and distribute your finished content directly to YouTube, Instagram, TikTok, and LinkedIn from a single unified dashboard.",
    color: "bg-amber-500/10 border-amber-500/20",
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-12 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_50%)] z-[-1]" />
        <div className="container px-4 md:px-6 mx-auto text-center max-w-4xl">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary shadow-sm mb-6">
            <Sparkles className="mr-2 h-4 w-4" />
            Everything you need
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl text-foreground mb-6 leading-tight">
            An entire production studio <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-500 drop-shadow-sm">powered by AI</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto font-medium">
            CreatorOS combines the best AI models into a seamless pipeline designed specifically for educational content creators.
          </p>
        </div>
      </section>

      {/* Main Features Grid */}
      <section className="py-12 md:py-20 bg-background/50 border-t border-border/40">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <div key={i} className="flex flex-col p-8 glass-card border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 shadow-lg group rounded-2xl">
                <div className={`p-4 rounded-xl w-14 h-14 flex items-center justify-center mb-6 border ${feature.color} group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed flex-1">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Pipeline Section */}
      <section className="py-16 lg:py-24 overflow-hidden relative">
        <div className="container px-4 md:px-6 mx-auto max-w-5xl">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="lg:w-1/2 space-y-6">
              <h2 className="text-3xl font-black tracking-tight md:text-4xl text-foreground drop-shadow-sm">
                The Unified Content Pipeline
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Stop jumping between 10 different AI tools. CreatorOS brings everything together in one cohesive workspace.
              </p>
              <ul className="space-y-4 pt-4">
                {[
                  "No more copy-pasting prompts",
                  "Consistent quality across formats",
                  "Organized asset library",
                  "10x faster production time"
                ].map((item, i) => (
                  <li key={i} className="flex items-center text-foreground">
                    <div className="mr-3 p-1 rounded-full bg-primary/20 text-primary">
                      <Zap className="h-4 w-4" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="lg:w-1/2 w-full">
              <div className="relative rounded-2xl glass-card p-6 md:p-8 aspect-square flex flex-col justify-center border-primary/20">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-violet-500/10 rounded-2xl opacity-50" />
                
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center gap-4 p-4 rounded-xl glass-panel shadow-sm border-l-4 border-l-indigo-400">
                    <Type className="h-6 w-6 text-indigo-400" />
                    <div>
                      <p className="font-medium text-sm text-foreground">Script Generated</p>
                      <p className="text-xs text-muted-foreground">1,200 words • Educational</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 rounded-xl glass-panel shadow-sm border-l-4 border-l-violet-400 ml-6">
                    <Mic className="h-6 w-6 text-violet-400" />
                    <div>
                      <p className="font-medium text-sm text-foreground">Voiceover Ready</p>
                      <p className="text-xs text-muted-foreground">Marcus (Professional) • 4:23</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 rounded-xl glass-panel shadow-sm border-l-4 border-l-fuchsia-400 ml-12">
                    <User className="h-6 w-6 text-fuchsia-400" />
                    <div>
                      <p className="font-medium text-sm text-foreground">Avatar Rendered</p>
                      <p className="text-xs text-muted-foreground">1080p • 60fps</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/20 shadow-sm border border-primary/30 ml-16 transform transition-transform hover:scale-105">
                    <Share2 className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-medium text-sm text-primary">Published to YouTube</p>
                      <p className="text-xs text-primary/70">Scheduled for today 10:00 AM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaSection />
    </div>
  );
}
