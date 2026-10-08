import { Sparkles, Brain, Rocket, Shield, Users } from "lucide-react";
import { CtaSection } from "@/components/cta-section";

export const metadata = {
  title: "About Us | CreatorOS AI",
  description: "Learn about the mission and team behind CreatorOS AI.",
};

const values = [
  {
    icon: <Brain className="h-6 w-6 text-indigo-400" />,
    title: "AI as an Amplifier",
    description: "We believe AI shouldn't replace creators, but amplify their unique voices and ideas, allowing them to produce at a scale previously impossible.",
  },
  {
    icon: <Rocket className="h-6 w-6 text-violet-400" />,
    title: "Uncompromising Quality",
    description: "Speed should never come at the expense of educational value. Our models are fine-tuned specifically for accuracy and pedagogical effectiveness.",
  },
  {
    icon: <Shield className="h-6 w-6 text-emerald-400" />,
    title: "Creator Ownership",
    description: "You own what you create. We provide the tools; you retain the rights, the audience, and the revenue.",
  },
  {
    icon: <Users className="h-6 w-6 text-fuchsia-400" />,
    title: "Built for Education",
    description: "While others focus on generic marketing copy, we are laser-focused on the unique needs of educators, coaches, and knowledge sharers.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-12 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.1),transparent_70%)] z-[-1]" />
        
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl text-foreground mb-6 leading-tight">
              Our mission is to democratize <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-500 drop-shadow-sm">educational content</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-medium">
              We&apos;re building the operating system for the next generation of knowledge creators.
            </p>
          </div>
        </div>
      </section>

      {/* The Story Section */}
      <section className="py-12 md:py-20 bg-background/50 border-t border-border/40 relative">
        <div className="container px-4 md:px-6 mx-auto max-w-5xl">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
            <div className="lg:w-1/2 space-y-6">
              <h2 className="text-3xl font-black tracking-tight text-foreground drop-shadow-sm">
                The CreatorOS Story
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed font-medium">
                <p>
                  CreatorOS AI was born out of frustration. As educational creators ourselves, we spent 20% of our time researching and teaching, and 80% of our time editing video, tweaking audio, and generating thumbnails.
                </p>
                <p>
                  We saw the rise of generative AI, but the tools were fragmented. You needed one subscription for scripts, another for voices, a third for avatars, and hours of manual work to stitch them all together.
                </p>
                <p>
                  So we built CreatorOS: a single, unified pipeline that takes a concept and outputs a polished, ready-to-publish educational video. By removing the friction of production, we allow creators to focus on what actually matters—the ideas.
                </p>
              </div>
            </div>
            <div className="lg:w-1/2 w-full">
              <div className="relative rounded-2xl glass-card aspect-video flex items-center justify-center overflow-hidden border-primary/20">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 mix-blend-overlay" />
                <div className="p-8 text-center space-y-4 relative z-10">
                  <Sparkles className="h-12 w-12 text-primary mx-auto opacity-50" />
                  <p className="text-xl font-medium italic">
                    &quot;Focus on the ideas.<br/>Let AI handle the production.&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-12 md:py-20 relative overflow-hidden">
        <div className="container px-4 md:px-6 mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tight text-foreground mb-4">Our Core Values</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto font-medium">The principles that guide how we build CreatorOS.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value, i) => (
              <div key={i} className="glass-card p-8 rounded-2xl flex gap-6 group border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 shadow-lg">
                <div className="shrink-0 mt-1">
                  <div className="p-3 rounded-xl bg-background border border-border/50 group-hover:scale-110 transition-transform">
                    {value.icon}
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{value.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection />
    </div>
  );
}
