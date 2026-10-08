import Link from "next/link";
import Image from "next/image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { getCustomUser } from "@/lib/auth/session";
import { MobileMenu } from "@/components/mobile-menu";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data } = await getCustomUser();
  const user = data?.user;

  return (
    <div className="flex flex-col min-h-screen bg-background bg-depth">
      <header className="sticky top-0 z-50 w-full glass">
        <div className="container flex h-16 max-w-screen-2xl items-center justify-between mx-auto px-4 md:px-8">
          <div className="flex gap-6 md:gap-8 items-center">
            <Link href="/" className="flex items-center space-x-2 transition-opacity hover:opacity-80">
              <Image src="/icon.png" alt="CreatorOS AI" width={28} height={28} className="rounded-md" />
              <span className="font-bold text-lg text-foreground tracking-tight">CreatorOS <span className="text-primary font-semibold">AI</span></span>
            </Link>
            <nav className="hidden md:flex gap-6 items-center">
              <Link href="/features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Features</Link>
              <Link href="/how-it-works" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">How it Works</Link>
              <Link href="/about" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">About Us</Link>
              <Link href="/contact" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Contact Us</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-block">Dashboard</Link>
                <a href="/auth/logout" className={buttonVariants({ variant: "outline", size: "sm", className: "font-medium rounded-md px-4 hidden sm:flex" })}>
                  Logout
                </a>
              </>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ size: "sm", className: "bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-md px-4 hidden sm:flex" })}>
                  Login
                </Link>
              </>
            )}
            <MobileMenu />
          </div>
        </div>
      </header>
      
      <main className="flex-1">{children}</main>
      
      <footer className="border-t border-border/40 py-12 md:py-16 bg-background/50 backdrop-blur-xl mt-auto">
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12 mb-12">
            <div className="space-y-4 md:col-span-1">
              <Link href="/" className="flex items-center space-x-2">
                <Image src="/icon.png" alt="CreatorOS AI" width={32} height={32} className="rounded-lg" />
                <span className="font-bold text-xl text-foreground tracking-tight">CreatorOS <span className="text-primary font-semibold">AI</span></span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Built for creators. The AI-powered educational content creation platform that scales your output without sacrificing quality.
              </p>
              <div className="flex gap-4 pt-2">
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
                  <span className="sr-only">Twitter</span>
                </Link>
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                  <span className="sr-only">GitHub</span>
                </Link>
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                  <span className="sr-only">LinkedIn</span>
                </Link>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Product</h4>
              <ul className="space-y-3">
                <li><Link href="/features" className="text-sm text-muted-foreground hover:text-primary transition-colors">Features</Link></li>
                <li><Link href="/how-it-works" className="text-sm text-muted-foreground hover:text-primary transition-colors">How it Works</Link></li>
                <li><Link href="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">Pricing</Link></li>
                <li><Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Company</h4>
              <ul className="space-y-3">
                <li><Link href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contact</Link></li>
                <li><Link href="/faq" className="text-sm text-muted-foreground hover:text-primary transition-colors">FAQs</Link></li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Legal</h4>
              <ul className="space-y-3">
                <li><Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="text-sm text-muted-foreground hover:text-primary transition-colors">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between border-t border-border/40 pt-8 gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} CreatorOS AI. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Built with AI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
