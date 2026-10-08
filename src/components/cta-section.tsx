import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="w-full py-16 md:py-20 overflow-hidden relative">
      <div className="absolute inset-0 bg-primary/5 z-[-1]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15),transparent_50%)] z-[-1]" />
      <div className="container px-4 md:px-6 mx-auto relative z-10">
        <div className="relative max-w-4xl mx-auto">
          {/* Glowing Border Animation */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary via-cyan-500 to-primary rounded-3xl blur opacity-30 animate-pulse"></div>
          
          <div className="relative flex flex-col items-center justify-center space-y-6 text-center glass-card border border-white/10 p-10 md:p-14 rounded-3xl bg-background/50 backdrop-blur-xl">
            <div className="space-y-4">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl text-foreground">
                Ready to transform your content?
              </h2>
              <p className="max-w-[600px] mx-auto text-muted-foreground md:text-lg font-medium">
                Join thousands of creators who are already using CreatorOS AI to scale their educational content empire.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-6 w-full sm:w-auto">
              <Link 
                href="/register" 
                className={buttonVariants({ 
                  size: "lg", 
                  className: "h-14 px-8 font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_rgba(99,102,241,0.4)] rounded-xl w-full sm:w-auto text-lg transition-transform hover:-translate-y-0.5" 
                })}
              >
                Start Creating Free <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link 
                href="/contact" 
                className={buttonVariants({ 
                  size: "lg", 
                  variant: "outline", 
                  className: "h-14 px-8 font-bold rounded-xl w-full sm:w-auto glass border border-white/10 hover:bg-white/10 text-lg transition-transform hover:-translate-y-0.5" 
                })}
              >
                Book a Demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
