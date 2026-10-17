/** Accept only an internal application path, including after URL decoding. */
export function safeRedirectPath(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string' || value.length > 2048) return fallback;
  let decoded = value;
  try {
    for (let pass = 0; pass < 3; pass++) {
      if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded) return value;
      decoded = next;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export function canonicalSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const url = new URL(raw);
  if (url.username || url.password || (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('Configure NEXT_PUBLIC_SITE_URL with the public HTTPS application URL.');
  }
  return url.origin;
}

export function sanitizeFilename(value: unknown, fallback = 'creatoros_download'): string {
  if (typeof value !== 'string') return fallback;
  const safe = value.normalize('NFKC').replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
  return safe || fallback;
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
