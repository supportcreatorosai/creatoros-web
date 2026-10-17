import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { TERMS_VERSION } from './validation'

export async function recordTermsAcceptance(supabase: SupabaseClient, user: User, accepted = false) {
  if (!accepted && user.user_metadata?.terms_version !== TERMS_VERSION) return true
  const { error } = await supabase.from('terms_acceptances').insert({ user_id: user.id, terms_version: TERMS_VERSION })
  // An existing receipt is enough; it remains immutable.
  return !error || error.code === '23505'
}
