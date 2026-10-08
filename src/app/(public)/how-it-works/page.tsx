import { BookOpen, Type, Mic, User, Image as ImageIcon, Calendar, Play, Sparkles } from "lucide-react";
import { CtaSection } from "@/components/cta-section";

export const metadata = {
  title: "How It Works | CreatorOS AI",
  description: "See the step-by-step process of creating educational content with CreatorOS AI.",
};

const steps = [
  {
    icon: <BookOpen className="h-6 w-6 text-indigo-400" />,
    title: "Enter Your Topic",
    description: "Start with a simple prompt, keyword, or paste a link to an existing article. CreatorOS analyzes the subject matter to understand the core educational concepts.",
    color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
  },
  {
    icon: <Type className="h-6 w-6 text-violet-400" />,
    title: "Generate Script",
    description: "Our AI generates a structured, engaging script optimized for retention. Edit the tone, length, and format (e.g., YouTube video vs. TikTok short) with a single click.",
    color: "bg-violet-500/10 border-violet-500/20 text-violet-500",
  },
  {
    icon: <Mic className="h-6 w-6 text-fuchsia-400" />,
    title: "Create Voiceover",
    description: "Select from hundreds of ultra-realistic AI voices or clone your own. The system automatically syncs pacing and adds appropriate pauses for educational clarity.",
    color: "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-500",
  },
  {
    icon: <User className="h-6 w-6 text-pink-400" />,
    title: "Render Avatar Video",
    description: "Choose a digital presenter or create a custom avatar. CreatorOS lipsyncs your chosen voiceover to the avatar in stunning 4K video quality.",
    color: "bg-pink-500/10 border-pink-500/20 text-pink-500",
  },
  {
    icon: <ImageIcon className="h-6 w-6 text-blue-400" />,
    title: "Design Thumbnail",
    description: "AI generates multiple high-converting thumbnail options based on your content. Add text overlays and customize the branding to match your channel.",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-500",
  },
  {
    icon: <Type className="h-6 w-6 text-cyan-400" />,
    title: "Add Smart Captions",
    description: "Automatically transcribe the video and overlay dynamic, animated captions. Highlight key terms to keep viewers engaged throughout the lesson.",
    color: "bg-cyan-500/10 border-cyan-500/20 text-cyan-500",
  },
  {
    icon: <Calendar className="h-6 w-6 text-emerald-400" />,
    title: "Schedule Content",
    description: "Plan your content calendar directly within CreatorOS. Write SEO-optimized descriptions and tags generated automatically from your script.",
    color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
  },
  {
    icon: <Play className="h-6 w-6 text-amber-400" />,
    title: "Auto-Publish",
    description: "Sit back as CreatorOS distributes your finished video, thumbnail, and metadata to YouTube, Instagram, and other platforms at the optimal time.",
    color: "bg-amber-500/10 border-amber-500/20 text-amber-500",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_50%)] z-[-1]" />
        
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary shadow-sm mb-6">
              <Sparkles className="mr-2 h-4 w-4" />
              The Pipeline
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground mb-6">
              From idea to published video
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Discover how CreatorOS AI streamlines the entire educational content creation process into 8 simple automated steps.
            </p>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-16 md:py-24 relative">
        {/* Connecting Line (Desktop) */}
        <div className="hidden md:block absolute left-1/2 top-32 bottom-32 w-0.5 bg-gradient-to-b from-indigo-500/50 via-fuchsia-500/50 to-emerald-500/50 -translate-x-1/2 z-0"></div>

        <div className="container px-4 md:px-6 mx-auto relative z-10 max-w-5xl">
          <div className="space-y-12 md:space-y-0">
            {steps.map((step, index) => {
              const isEven = index % 2 === 0;
              return (
                <div key={index} className={`flex flex-col md:flex-row items-center gap-8 md:gap-16 md:h-64 ${isEven ? 'md:flex-row-reverse' : ''}`}>
                  
                  {/* Content Side */}
                  <div className={`md:w-1/2 flex ${isEven ? 'md:justify-start' : 'md:justify-end'} w-full`}>
                    <div className="glass-card p-8 rounded-2xl max-w-[450px] w-full text-left relative group hover:border-primary/50 transition-colors">
                      {/* Mobile Step Number Indicator (Hidden on Desktop) */}
                      <div className={`md:hidden absolute -top-4 -left-4 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-4 border-background ${step.color}`}>
                        {index + 1}
                      </div>
                      
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`p-3 rounded-xl border ${step.color} bg-background/50`}>
                          {step.icon}
                        </div>
                        <h3 className="text-2xl font-bold text-foreground">{step.title}</h3>
                      </div>
                      <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Center Node (Desktop Only) */}
                  <div className="hidden md:flex relative justify-center items-center w-16 h-16 shrink-0">
                    <div className="absolute w-12 h-12 rounded-full bg-background border-4 border-muted z-10 flex items-center justify-center">
                      <span className={`font-bold text-lg ${step.color.split(' ').find(c => c.startsWith('text-'))}`}>
                        {index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Empty Side (For Layout) */}
                  <div className="hidden md:block md:w-1/2"></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <CtaSection />
    </div>
  );
}
