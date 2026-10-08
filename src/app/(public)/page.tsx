import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Play, BookOpen, Mic, User, Image as ImageIcon, Video, Calendar, Sparkles, Type } from "lucide-react";
import { CtaSection } from "@/components/cta-section";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative w-full pt-8 pb-16 md:pt-16 md:pb-24 flex flex-col items-center justify-center overflow-hidden min-h-[90vh] border-b border-white/5">
        {/* Generated Premium Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero_bg.jpg" 
            alt="Hero Background" 
            className="w-full h-full object-cover opacity-90 mix-blend-screen"
          />
          {/* Gradient Overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background/40"></div>
          {/* Subtle Grid Overlay */}
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]"></div>
        </div>

        {/* Dynamic Glowing Orbs for extra ambience */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] max-w-[600px] h-[100vw] max-h-[600px] bg-primary/20 rounded-full mix-blend-screen filter blur-[120px] opacity-70 animate-pulse pointer-events-none"></div>
        
        <div className="container px-4 md:px-6 mx-auto relative z-10 flex flex-col items-center justify-center pt-8">
          
          <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-4xl mx-auto">
            <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-semibold text-primary shadow-[0_0_20px_rgba(99,102,241,0.25)] backdrop-blur-md mb-8 hover:bg-primary/20 transition-colors cursor-pointer">
              <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
              CreatorOS Early Access is Live
              <ArrowRight className="ml-2 h-4 w-4 opacity-70" />
            </div>
            
            <h1 className="text-5xl font-black tracking-tight sm:text-6xl md:text-7xl lg:text-7xl text-foreground drop-shadow-sm mb-6 leading-[1.1]">
              The Operating System for <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 drop-shadow-[0_0_30px_rgba(99,102,241,0.4)]">Digital Creators.</span>
            </h1>
            
            <p className="max-w-[700px] text-muted-foreground md:text-xl lg:text-2xl leading-relaxed font-medium mb-10">
              Turn a single idea into scripts, voiceovers, videos, thumbnails, and captions. Publish everywhere — <strong className="text-foreground">automatically</strong>.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Link href="/templates" className="group relative h-14 px-8 flex items-center justify-center font-bold bg-primary text-primary-foreground rounded-xl shadow-[0_8px_30px_rgba(99,102,241,0.4)] hover:shadow-[0_8px_40px_rgba(99,102,241,0.6)] transition-all duration-300 hover:-translate-y-0.5 overflow-hidden w-full sm:w-auto text-lg">
                <div className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-out skew-x-12"></div>
                Start Creating Free <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/how-it-works" className="group h-14 px-8 flex items-center justify-center font-bold rounded-xl w-full sm:w-auto glass border border-white/10 hover:bg-white/10 transition-all duration-300 hover:-translate-y-0.5 text-lg">
                <Play className="mr-2 h-5 w-5 opacity-70 group-hover:text-primary transition-colors" />
                Watch Demo
              </Link>
            </div>
          </div>

          {/* Floating Glass Component to anchor the UI */}
          <div className="w-full max-w-4xl mx-auto mt-20 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 hidden md:block relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-cyan-500 rounded-2xl blur-lg opacity-20 animate-pulse"></div>
            <div className="relative glass-card border border-white/10 rounded-2xl p-2 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-6 px-6">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Generations</span>
                  <span className="text-xl font-black text-foreground">14.2M+</span>
                </div>
                <div className="w-px h-10 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Time Saved</span>
                  <span className="text-xl font-black text-cyan-400">2.5M hrs</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pr-4">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full border-2 border-background bg-indigo-500 flex items-center justify-center font-bold text-xs shadow-sm">AI</div>
                  <div className="w-10 h-10 rounded-full border-2 border-background bg-violet-500 flex items-center justify-center font-bold text-xs shadow-sm">HQ</div>
                  <div className="w-10 h-10 rounded-full border-2 border-background bg-cyan-500 flex items-center justify-center font-bold text-xs shadow-sm">8K</div>
                </div>
                <div className="pl-4">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Loved by 10,000+ creators</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* Workflow Section */}
      <section className="relative w-full py-16 md:py-20 overflow-hidden border-b border-white/5">
        {/* Generated Premium Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/workflow_bg.jpg" 
            alt="Workflow Background" 
            className="w-full h-full object-cover opacity-60 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"></div>
        </div>

        <div className="container px-4 md:px-6 mx-auto relative z-10">
          
          <div className="flex flex-col items-center justify-center space-y-4 text-center mb-10 lg:mb-16">
            <h2 className="text-3xl md:text-5xl lg:text-5xl font-black tracking-tight text-foreground drop-shadow-sm">How CreatorOS Works</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl font-medium">
              From topic to published video in 8 automated steps.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: Premium Generated Side Image */}
            <div className="relative order-2 lg:order-1 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="absolute -inset-1 bg-gradient-to-br from-green-500 to-purple-600 rounded-3xl blur-xl opacity-20"></div>
              <div className="relative rounded-3xl overflow-hidden glass-card border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.4)] aspect-[4/3] lg:aspect-square group">
                <img 
                  src="/workflow_side.jpg" 
                  alt="AI Workflow Machine" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              </div>
            </div>
            
            {/* Right Column: Workflow Steps Grid */}
            <div className="grid grid-cols-2 gap-4 md:gap-6 order-1 lg:order-2">
              {[
                { icon: <BookOpen className="h-6 w-6" />, title: "Enter Topic" },
                { icon: <Type className="h-6 w-6" />, title: "Generate Script" },
                { icon: <Mic className="h-6 w-6" />, title: "Generate Voice" },
                { icon: <User className="h-6 w-6" />, title: "Avatar Video" },
                { icon: <ImageIcon className="h-6 w-6" />, title: "Thumbnail" },
                { icon: <Type className="h-6 w-6" />, title: "Captions" },
                { icon: <Calendar className="h-6 w-6" />, title: "Schedule" },
                { icon: <Play className="h-6 w-6" />, title: "Auto Publish" },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-start p-6 glass border-white/10 rounded-2xl group hover:-translate-y-1 hover:bg-white/10 transition-all duration-300 shadow-lg">
                  <div className="flex items-center space-x-4 mb-4">
                    <span className="text-xl font-black text-white/20 group-hover:text-primary/40 transition-colors">0{i+1}</span>
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary group-hover:bg-primary/20 transition-all duration-300">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-200 tracking-wide text-lg">{step.title}</h3>
                </div>
              ))}
            </div>
            
          </div>
        </div>
      </section>

      <CtaSection />
    </div>
  );
}
