'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canonicalSiteUrl, safeRedirectPath } from '@/lib/security/validation'
import { emailSchema, loginSchema, registerSchema, verificationSchema, hasVerifiedEmail, TERMS_PENDING_COOKIE, TERMS_VERSION } from '@/lib/auth/validation'
import { recordTermsAcceptance } from '@/lib/auth/terms'
import { emailConfirmationEnabled } from '@/lib/auth/configuration'

function confirmationUrl(next: string) {
  const url = new URL('/auth/callback', canonicalSiteUrl())
  url.searchParams.set('next', next)
  return url.toString()
}

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const next = safeRedirectPath(formData.get('redirectTo'))
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    if (error.code === 'email_not_confirmed') {
      redirect(`/otp-verify?${new URLSearchParams({ email: parsed.data.email, redirectTo: next })}`)
    }
    return { error: 'Unable to sign in. Check your email and password.' }
  }
  if (!data.user || !hasVerifiedEmail(data.user)) {
    await supabase.auth.signOut()
    return { error: 'Confirm your email before signing in.' }
  }
  if (!(await recordTermsAcceptance(supabase, data.user))) {
    await supabase.auth.signOut()
    return { error: 'Unable to save your terms acceptance. Please try again later.' }
  }
  revalidatePath('/dashboard', 'layout')
  redirect(next)
}

export async function signup(formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'), email: formData.get('email'), password: formData.get('password'),
    confirmPassword: formData.get('confirm-password'), terms: formData.get('terms') === 'true',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await emailConfirmationEnabled())) return { error: 'Email registration is temporarily unavailable. Use Google sign-in or contact support.' }
  const next = safeRedirectPath(formData.get('redirectTo'))
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email, password: parsed.data.password,
    options: {
      emailRedirectTo: confirmationUrl(next),
      data: { full_name: parsed.data.name, terms_version: TERMS_VERSION, is_first_login: true },
    },
  })
  if (error) return { error: 'Unable to create this account. Please try again later.' }
  if (data.session && data.user && hasVerifiedEmail(data.user)) {
    if (!(await recordTermsAcceptance(supabase, data.user))) {
      await supabase.auth.signOut()
      return { error: 'Unable to save your terms acceptance. Please try again later.' }
    }
    revalidatePath('/dashboard', 'layout')
    redirect(next)
  }
  redirect(`/otp-verify?${new URLSearchParams({ email: parsed.data.email, redirectTo: next })}`)
}

export async function loginWithGoogle(formData: FormData) {
  if (formData.get('terms') !== 'true') return { error: 'Accept the Terms of Service before continuing with Google.' }
  const next = safeRedirectPath(formData.get('redirectTo'))
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: confirmationUrl(next), skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  })
  if (error || !data.url) return { error: 'Google sign-in is unavailable. Please try email sign-in.' }
  const cookieStore = await cookies()
  cookieStore.set(TERMS_PENDING_COOKIE, TERMS_VERSION, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/auth/callback', maxAge: 600,
  })
  redirect(data.url)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function verifyOTP(formData: FormData) {
  const parsed = verificationSchema.safeParse({ email: formData.get('email'), token: formData.get('token') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ ...parsed.data, type: 'email' })
  if (error || !data.user || !hasVerifiedEmail(data.user)) return { error: 'This code is invalid or expired. Request a new confirmation email.' }
  if (!(await recordTermsAcceptance(supabase, data.user))) {
    await supabase.auth.signOut()
    return { error: 'Unable to save your terms acceptance. Please try again later.' }
  }
  revalidatePath('/dashboard', 'layout')
  redirect(safeRedirectPath(formData.get('redirectTo')))
}

export async function resendVerification(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup', email: parsed.data,
    options: { emailRedirectTo: confirmationUrl(safeRedirectPath(formData.get('redirectTo'))) },
  })
  if (error) return { error: 'Unable to resend right now. Wait a minute and try again.' }
  return { success: 'If this account needs confirmation, a new email has been requested. Check your inbox and spam folder.' }
}
