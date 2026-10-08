import { Mail, MapPin, MessageSquare } from "lucide-react";
import { CtaSection } from "@/components/cta-section";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Contact Us | CreatorOS AI",
  description: "Get in touch with the CreatorOS AI team for support, sales, or partnerships.",
};

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative py-12 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_50%)] z-[-1]" />
        
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl text-foreground mb-6 leading-tight">
              Get in touch
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-medium">
              Whether you have a question about pricing, need support, or want to explore an enterprise partnership, we&apos;re here to help.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
            
            {/* Contact Info Sidebar */}
            <div className="lg:col-span-1 space-y-8">
              <div className="glass-card p-8 rounded-2xl space-y-6 border border-white/10 bg-primary/5">
                <h3 className="text-xl font-bold text-foreground">Contact Information</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Email</p>
                      <a href="mailto:support.creatorosai@gmail.com" className="text-muted-foreground hover:text-primary transition-colors text-sm">
                        support.creatorosai@gmail.com
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">

                    <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Office</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        Ghaziabad, Uttar Pradesh<br />
                        India
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-white/5">
                <h4 className="font-bold text-foreground mb-2">Response Times</h4>
                <p className="text-sm text-muted-foreground font-medium">
                  We aim to respond to all inquiries within 24 hours during normal business hours (M-F, 9am-5pm PT).
                </p>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="glass-card p-8 md:p-10 rounded-3xl border border-white/10 shadow-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">Send us a message</h2>
                
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="first-name" className="text-sm font-medium text-foreground">First name</label>
                      <input 
                        type="text" 
                        id="first-name" 
                        className="w-full bg-background/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                        placeholder="Jane"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="last-name" className="text-sm font-medium text-foreground">Last name</label>
                      <input 
                        type="text" 
                        id="last-name" 
                        className="w-full bg-background/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                    <input 
                      type="email" 
                      id="email" 
                      className="w-full bg-background/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                      placeholder="jane@example.com"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="subject" className="text-sm font-medium text-foreground">Subject</label>
                    <select 
                      id="subject" 
                      className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow appearance-none"
                    >
                      <option value="">Select a topic...</option>
                      <option value="support">Technical Support</option>
                      <option value="billing">Billing Question</option>
                      <option value="partnership">Partnership</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium text-foreground">Message</label>
                    <textarea 
                      id="message" 
                      rows={6}
                      className="w-full bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow resize-none"
                      placeholder="How can we help you?"
                    ></textarea>
                  </div>
                  
                  <Button type="button" size="lg" className="w-full">
                    Send Message
                  </Button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </section>

      <CtaSection />
    </div>
  );
}
