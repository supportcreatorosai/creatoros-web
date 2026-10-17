import { z } from 'zod'

export const TERMS_VERSION = '2026-10-09'
export const TERMS_PENDING_COOKIE = 'creatoros_terms_pending'

export function hasVerifiedEmail(user: { email?: string; email_confirmed_at?: string; is_anonymous?: boolean } | null | undefined): boolean {
  return Boolean(user?.email && user.email_confirmed_at && !user.is_anonymous)
}

export const emailSchema = z.string().trim().email('Please enter a valid email address').max(254)
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(256),
})
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(256),
  confirmPassword: z.string(),
  terms: z.boolean().refine(value => value, 'You must accept the Terms of Service'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
})
export const verificationSchema = z.object({
  email: emailSchema,
  token: z.string().trim().regex(/^\d{6,10}$/, 'Enter the verification code from your email'),
})
