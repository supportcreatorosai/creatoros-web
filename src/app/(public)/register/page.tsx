"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signup } from "@/app/auth/actions"

import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight, Eye, EyeOff, CheckCircle } from "lucide-react"

const registerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val === true, {
    message: "You must agree to the Terms of Service and Privacy Policy"
  })
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function RegisterForm() {
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirectTo") || "/dashboard"

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  })

  async function onSubmit(values: z.infer<typeof registerSchema>) {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    const formData = new FormData()
    formData.append("name", values.name)
    formData.append("email", values.email)
    formData.append("password", values.password)
    formData.append("confirm-password", values.confirmPassword)
    if (redirectTo) {
      formData.append("redirectTo", redirectTo)
    }

    const result = await signup(formData)
    
    if (result?.error) {
      setError(result.error)
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    // Implement Google OAuth redirect later
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 right-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-32 left-10 w-96 h-96 bg-indigo-300/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]"></div>
          <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-violet-300/10 rounded-full blur-3xl animate-pulse [animation-delay:4s]"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-2 text-sm text-white/90 border border-white/10">
              <Sparkles className="h-4 w-4" />
              Join thousands of creators
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Start creating with<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-violet-200">CreatorOS AI</span>
            </h1>
            <p className="text-lg text-white/70 max-w-md leading-relaxed">
              Turn your ideas into scripts, voice, video, thumbnails, and publish-ready content — all powered by AI.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {[
              "Free to start, no credit card needed",
              "Access all AI content tools",
              "Export and publish anywhere",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-white/80">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <Link href="/" className="text-2xl font-bold text-foreground">
              CreatorOS <span className="text-primary">AI</span>
            </Link>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Create account</h2>
            <p className="text-muted-foreground">
              Get started with CreatorOS AI for free
            </p>
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground text-sm font-medium transition-all duration-200 hover:shadow-md"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground tracking-wider">
                or
              </span>
            </div>
          </div>

          {successMessage && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">{successMessage}</div>
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="reg-name">
                Full Name
              </label>
              <input 
                id="reg-name" 
                placeholder="John Doe"
                className="glass-input"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="reg-email">
                Email
              </label>
              <input 
                id="reg-email" 
                type="email" 
                placeholder="name@example.com"
                className="glass-input"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="reg-password">
                Password
              </label>
              <div className="relative">
                <input 
                  id="reg-password" 
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  className="glass-input pr-10"
                  {...form.register("password")}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="reg-confirm">
                Confirm Password
              </label>
              <input 
                id="reg-confirm" 
                type="password"
                className="glass-input"
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex items-start space-x-3 pt-2">
              <input 
                type="checkbox" 
                id="reg-terms" 
                className="mt-1 flex-shrink-0 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...form.register("terms")}
              />
              <label htmlFor="reg-terms" className="text-sm text-muted-foreground leading-snug">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </Link>.
              </label>
            </div>
            {form.formState.errors.terms && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.terms.message}</p>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full h-12 text-sm font-medium" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Create Account <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-[80vh]"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>}>
      <RegisterForm />
    </Suspense>
  )
}
