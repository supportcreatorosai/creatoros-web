import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';

export class MediaFetchError extends Error {
  readonly status: number;
  constructor(message = 'The media URL is not permitted.', status = 400) { super(message); this.status = status; }
}

const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [ip, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blockedV4.addSubnet(ip, bits, 'ipv4');
for (const [ip, bits] of [['::', 96], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 32], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) blockedV6.addSubnet(ip, bits, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  // Public IPv6 unicast is 2000::/3; reject local, mapped, multicast and reserved ranges.
  if (family === 6 && !/^[23]/i.test(address)) return false;
  return family === 4 ? !blockedV4.check(address, 'ipv4') : family === 6 && !blockedV6.check(address, 'ipv6');
}

const standardHosts = [
  'image.pollinations.ai', 'gen.pollinations.ai',
  'result.d-id.com', 'clips-presenters.d-id.com', 'create-images-results.d-id.com',
  'd-id-talks-prod.s3.us-west-2.amazonaws.com', 'd-id-talks-prod.s3.amazonaws.com',
  'd-id-public-bucket.s3.us-west-2.amazonaws.com',
];

type Address = { address: string; family: number };
type MediaResponse = { status: number; headers: Record<string, string | string[] | undefined>; body: AsyncIterable<Uint8Array>; cancel: () => void };
type FetchOptions = { maxBytes?: number; timeoutMs?: number; allowedTypes?: string[] };
type Dependencies = {
  resolve?: (hostname: string) => Promise<Address[]>;
  transport?: (url: URL, address: Address, signal: AbortSignal) => Promise<MediaResponse>;
  hosts?: string[];
};

async function transport(url: URL, address: Address, signal: AbortSignal): Promise<MediaResponse> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {
      method: 'GET', agent: false, signal, family: address.family,
      // Pin the validated DNS address: the connection must never perform a second lookup.
      lookup(_hostname, _options, callback) { callback(null, address.address, address.family); },
      headers: { Accept: 'image/*,video/*,audio/*', 'User-Agent': 'CreatorOS-Media/1.0' },
    }, response => resolve({ status: response.statusCode || 502, headers: response.headers, body: response, cancel: () => response.destroy() }));
    req.on('error', reject);
    req.end();
  });
}

function configuredHosts(): string[] {
  const hosts = [...standardHosts];
  for (const raw of [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    if (!raw) continue;
    try { const url = new URL(raw); if (url.protocol === 'https:') hosts.push(url.hostname); } catch { /* invalid config is never trusted */ }
  }
  for (const host of (process.env.MEDIA_ALLOWED_HOSTS || '').split(',').map(h => h.trim().toLowerCase())) {
    if (/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/.test(host)) hosts.push(host);
  }
  return hosts;
}

/** Injectable transport is used by adversarial tests; production always pins DNS. */
export function createMediaFetcher(dependencies: Dependencies = {}) {
  const resolve = dependencies.resolve || (hostname => lookup(hostname, { all: true, verbatim: true }));
  const send = dependencies.transport || transport;
  async function validate(raw: string): Promise<{ url: URL; address: Address }> {
    if (typeof raw !== 'string' || raw.length > 8192 || /[\\\u0000-\u0020\u007f]/.test(raw)) throw new MediaFetchError();
    let url: URL;
    try { url = new URL(raw); } catch { throw new MediaFetchError(); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443') || isIP(url.hostname.replace(/^\[|\]$/g, ''))) throw new MediaFetchError();
    if (!(dependencies.hosts || configuredHosts()).includes(url.hostname)) throw new MediaFetchError();
    let addresses: Address[];
    try { addresses = await resolve(url.hostname); } catch { throw new MediaFetchError('The media server could not be resolved.', 502); }
    if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new MediaFetchError();
    return { url, address: addresses[0] };
  }
  return {
    async validateMediaUrl(raw: string): Promise<URL> { return (await validate(raw)).url; },
    async fetchMedia(raw: string, options: FetchOptions = {}): Promise<{ buffer: Buffer; contentType: string; url: string }> {
      const maxBytes = Math.min(options.maxBytes || 50 * 1024 * 1024, 50 * 1024 * 1024);
      const timeoutMs = Math.min(options.timeoutMs || 20000, 60000);
      if (maxBytes < 1 || timeoutMs < 1) throw new MediaFetchError();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const deadline = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new MediaFetchError('Media download timed out.', 504)), { once: true }));
      let response: MediaResponse | undefined;
      try {
        return await Promise.race([deadline, (async () => {
          let current = raw;
          for (let hop = 0; hop < 4; hop++) {
            const { url, address } = await validate(current);
            if (controller.signal.aborted) throw new MediaFetchError('Media download timed out.', 504);
            response = await send(url, address, controller.signal);
            if ([301, 302, 303, 307, 308].includes(response.status)) {
              const location = response.headers.location;
              response.cancel();
              if (typeof location !== 'string') throw new MediaFetchError('Invalid media redirect.', 502);
              current = new URL(location, url).href;
              continue;
            }
            if (response.status < 200 || response.status > 299) throw new MediaFetchError('The media server returned an error.', 502);
            const typeHeader = response.headers['content-type'];
            const contentType = typeof typeHeader === 'string' ? typeHeader.split(';')[0].trim().toLowerCase() : '';
            const allowed = options.allowedTypes || ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/webm'];
            if (!allowed.includes(contentType)) throw new MediaFetchError('Unsupported media type.', 415);
            const advertised = Number(response.headers['content-length']);
            if (Number.isFinite(advertised) && advertised > maxBytes) throw new MediaFetchError('Media exceeds the download size limit.', 413);
            let length = 0;
            const chunks: Buffer[] = [];
            for await (const chunk of response.body) {
              length += chunk.byteLength;
              if (length > maxBytes) throw new MediaFetchError('Media exceeds the download size limit.', 413);
              chunks.push(Buffer.from(chunk));
            }
            return { buffer: Buffer.concat(chunks), contentType, url: url.href };
          }
          throw new MediaFetchError('Too many media redirects.', 400);
        })()]);
      } catch (error) {
        if (error instanceof MediaFetchError) throw error;
        throw new MediaFetchError(controller.signal.aborted ? 'Media download timed out.' : 'Media download failed.', controller.signal.aborted ? 504 : 502);
      } finally {
        clearTimeout(timer);
        controller.abort();
        response?.cancel();
      }
    },
  };
}

const mediaFetcher = createMediaFetcher();
export const validateMediaUrl = mediaFetcher.validateMediaUrl;
export const fetchMedia = mediaFetcher.fetchMedia;
