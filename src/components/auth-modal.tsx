"use client"

import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LogIn, UserPlus, Sparkles } from "lucide-react"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md glass-card border-border/50 p-0 overflow-hidden">
        {/* Gradient Header */}
        <div className="relative bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 px-6 pt-8 pb-6">
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white">Ready to Create?</DialogTitle>
              <DialogDescription className="text-white/80 pt-1">
                Sign in or create a free account to start building with AI.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 space-y-3">
          <Link 
            href="/login" 
            className={cn(
              buttonVariants({ variant: "default" }), 
              "w-full h-12 text-sm font-medium gap-2"
            )}
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </Link>
          <Link 
            href="/register" 
            className={cn(
              buttonVariants({ variant: "outline" }), 
              "w-full h-12 text-sm font-medium gap-2 border-border/50"
            )}
          >
            <UserPlus className="h-4 w-4" />
            Create Free Account
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
