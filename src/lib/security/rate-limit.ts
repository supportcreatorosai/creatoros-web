import type { SupabaseClient } from '@supabase/supabase-js';

export class RateLimitError extends Error {
  readonly status = 429;
  constructor() { super('Too many requests. Please wait before trying again.'); }
}

export class RateLimitUnavailableError extends Error {
  readonly status = 503;
  constructor() { super('Request protection is unavailable. Please try again later or contact support.'); }
}

/** Atomic database limits work across processes and serverless instances. */
export async function enforceRateLimit(supabase: SupabaseClient, bucket: string, limit: number, windowSeconds: number): Promise<void> {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(bucket) || !Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400) {
    throw new RateLimitUnavailableError();
  }
  const { data, error } = await supabase.rpc('check_rate_limit', { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
  if (error || typeof data !== 'boolean') throw new RateLimitUnavailableError();
  if (!data) throw new RateLimitError();
}
