/** Require the configured auth service to verify email ownership before email registration. */
export async function emailConfirmationEnabled(options: { url?: string; anonKey?: string; fetchImpl?: typeof fetch } = {}): Promise<boolean> {
  try {
    const url = new URL(options.url || process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    const key = options.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key || url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)) return false;
    const response = await (options.fetchImpl || fetch)(new URL('/auth/v1/settings', url), {
      headers: { apikey: key }, cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) { await response.body?.cancel(); return false; }
    const settings = await response.json() as { mailer_autoconfirm?: unknown; external?: { email?: unknown } };
    return settings.mailer_autoconfirm === false && settings.external?.email === true;
  } catch { return false; }
}
