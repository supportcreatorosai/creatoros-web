import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Only server code may create provider jobs; browser clients cannot claim job IDs. */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Video job storage is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
