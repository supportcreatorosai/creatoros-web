"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { verifyOTP, resendVerification } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { ShieldCheck } from "lucide-react"

function VerificationForm() {
  const params = useSearchParams()
  const [email, setEmail] = useState(params.get("email") || "")
  const [token, setToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function data() {
    const form = new FormData()
    form.set("email", email)
    form.set("token", token)
    form.set("redirectTo", params.get("redirectTo") || "/dashboard")
    return form
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(null); setMessage(null)
    try {
      const result = await verifyOTP(data())
      if (result?.error) setError(result.error)
    } catch {
      setError("Verification is unavailable. Please try again.")
    } finally { setBusy(false) }
  }
  async function resend() {
    setBusy(true); setError(null); setMessage(null)
    try {
      const result = await resendVerification(data())
      if (result.error) setError(result.error)
      else setMessage(result.success || null)
    } catch { setError("Unable to request a confirmation email right now.") }
    finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-6">
        <ShieldCheck className="h-10 w-10 text-primary" />
        <h1 className="text-2xl font-bold">Confirm your email</h1>
        <p className="text-sm text-muted-foreground">Open the confirmation link in your signup email. If the email includes a verification code, you can enter it here. Check your spam folder, or request another email below.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium" htmlFor="verify-email">Email address</label>
          <input id="verify-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="glass-input" />
          <label className="block text-sm font-medium" htmlFor="verify-code">Verification code</label>
          <input id="verify-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={token} onChange={event => setToken(event.target.value.replace(/\D/g, ""))} className="glass-input" />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait..." : "Verify email"}</Button>
        </form>
        <Button variant="outline" className="w-full" onClick={resend} disabled={busy || !email}>Resend confirmation email</Button>
        <Link href="/login" className="block text-center text-sm text-primary">Return to sign in</Link>
        <form action="/auth/logout" method="post"><Button variant="ghost" className="w-full" type="submit">Sign out of this session</Button></form>
      </div>
    </div>
  )
}
export default function VerificationPage() {
  return <Suspense fallback={<p className="p-8">Loading verification...</p>}><VerificationForm /></Suspense>
}
