export function securityHeaders(nonce: string, development: boolean, supabaseUrl?: string): Record<string, string> {
  if (!/^[A-Za-z0-9+/=]+$/.test(nonce)) throw new Error('Invalid CSP nonce');
  const connections = ["'self'"];
  if (supabaseUrl) {
    const url = new URL(supabaseUrl);
    if (url.protocol === 'https:') connections.push(url.origin, `wss://${url.host}`);
  }
  if (development) connections.push('ws:', 'http://localhost:*');
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "media-src 'self' https: blob:",
    "font-src 'self' data:",
    `connect-src ${connections.join(' ')}`,
    "worker-src 'self' blob:",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(development ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
  return {
    'Content-Security-Policy': policy,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...(!development ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  };
}
