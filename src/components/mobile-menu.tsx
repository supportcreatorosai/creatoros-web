"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden flex items-center">
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 -mr-2 text-foreground">
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="absolute top-16 left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-white/10 p-4 flex flex-col gap-2 shadow-2xl animate-in slide-in-from-top-2 z-50">
          <Link href="/features" onClick={() => setIsOpen(false)} className="text-base font-medium text-foreground p-3 rounded-xl hover:bg-white/5 transition-colors">Features</Link>
          <Link href="/how-it-works" onClick={() => setIsOpen(false)} className="text-base font-medium text-foreground p-3 rounded-xl hover:bg-white/5 transition-colors">How it Works</Link>
          <Link href="/about" onClick={() => setIsOpen(false)} className="text-base font-medium text-foreground p-3 rounded-xl hover:bg-white/5 transition-colors">About Us</Link>
          <Link href="/contact" onClick={() => setIsOpen(false)} className="text-base font-medium text-foreground p-3 rounded-xl hover:bg-white/5 transition-colors">Contact Us</Link>
        </div>
      )}
    </div>
  );
}
