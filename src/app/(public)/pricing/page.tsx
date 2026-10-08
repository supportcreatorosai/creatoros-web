import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "Pricing | CreatorOS AI",
  description: "Simple, transparent pricing for creators of all sizes.",
};

const tiers = [
  {
    name: "Free",
    id: "tier-free",
    href: "/register",
    priceMonthly: "$0",
    description: "Perfect for testing the waters and learning the platform.",
    features: [
      "5 content pieces per month",
      "720p Video exports",
      "Standard AI voices",
      "Basic templates",
      "Community support",
    ],
    featured: false,
    cta: "Get Started",
  },
  {
    name: "Pro",
    id: "tier-pro",
    href: "/register?plan=pro",
    priceMonthly: "$29",
    description: "Everything you need to scale your educational content.",
    features: [
      "50 content pieces per month",
      "4K Video exports",
      "Premium AI voices & cloning",
      "Custom avatars",
      "Auto-publishing to all platforms",
      "Priority email support",
    ],
    featured: true,
    cta: "Start 14-Day Free Trial",
  },
  {
    name: "Enterprise",
    id: "tier-enterprise",
    href: "/contact",
    priceMonthly: "Custom",
    description: "For teams and agencies managing multiple creators.",
    features: [
      "Unlimited content generation",
      "Custom AI model fine-tuning",
      "API access",
      "White-label options",
      "Dedicated account manager",
      "24/7 phone support",
    ],
    featured: false,
    cta: "Contact Sales",
  },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <section className="relative py-12 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.15),transparent_50%)] z-[-1]" />
        
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl text-foreground mb-6 leading-tight">
              Simple, transparent pricing
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-medium">
              Choose the perfect plan for your content creation journey. Upgrade or downgrade at any time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 max-w-6xl mx-auto items-center">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`relative flex flex-col p-8 glass-card rounded-3xl transition-transform hover:-translate-y-1 ${
                  tier.featured 
                    ? "border-primary/50 shadow-[0_0_40px_rgba(99,102,241,0.3)] md:-mt-8 md:mb-8 md:scale-105" 
                    : "border-white/5 hover:border-white/20 shadow-lg"
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center shadow-lg">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-foreground mb-2">{tier.name}</h3>
                  <p className="text-muted-foreground text-sm h-10">{tier.description}</p>
                </div>
                
                <div className="mb-8 flex items-baseline text-foreground">
                  <span className="text-5xl font-bold tracking-tight">{tier.priceMonthly}</span>
                  {tier.priceMonthly !== "Custom" && <span className="text-muted-foreground ml-2">/month</span>}
                </div>
                
                <Link
                  href={tier.href}
                  className={buttonVariants({
                    variant: tier.featured ? "default" : "outline",
                    className: `w-full mb-8 h-12 ${
                      tier.featured ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md" : "glass-panel hover:bg-white/5"
                    }`
                  })}
                >
                  {tier.cta}
                </Link>
                
                <div className="space-y-4 flex-1">
                  <h4 className="text-sm font-medium text-foreground">What&apos;s included:</h4>
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start text-sm text-muted-foreground">
                        <Check className="h-5 w-5 text-primary shrink-0 mr-3" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-12 md:py-20 bg-background/50 border-t border-border/40">
        <div className="container px-4 md:px-6 mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tight text-foreground">Frequently Asked Questions</h2>
          </div>
          
          <div className="grid gap-6">
            {[
              {
                q: "Can I cancel my subscription at any time?",
                a: "Yes, you can cancel your subscription at any time from your account settings. You will retain access to your plan's features until the end of your current billing cycle."
              },
              {
                q: "What counts as a 'content piece'?",
                a: "A content piece is any completed output generated by CreatorOS. This could be a YouTube video, a short-form reel, a generated script, or a scheduled social media post."
              },
              {
                q: "Do I own the rights to the generated content?",
                a: "Absolutely. You retain 100% ownership and commercial rights to all content you generate and publish using CreatorOS AI."
              },
              {
                q: "Can I use my own voice and face?",
                a: "Yes, Pro and Enterprise plans include the ability to clone your own voice and create a custom digital avatar based on your likeness."
              }
            ].map((faq, i) => (
              <div key={i} className="glass-card p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                <h3 className="text-lg font-semibold text-foreground mb-2">{faq.q}</h3>
                <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
