import { NextResponse } from 'next/server';
import { getCustomUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { fetchMedia, MediaFetchError } from '@/lib/security/safe-fetch';
import { enforceRateLimit, RateLimitError, RateLimitUnavailableError } from '@/lib/security/rate-limit';
import { sanitizeFilename } from '@/lib/security/validation';

export async function GET(request: Request) {
  const { data: { user } } = await getCustomUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const customFilename = searchParams.get('filename');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    await enforceRateLimit(await createClient(), 'media-download', 30, 60);
    const { buffer, contentType } = await fetchMedia(url);
    const filename = sanitizeFilename(customFilename);

    // Create the response with attachment headers
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof MediaFetchError || error instanceof RateLimitError || error instanceof RateLimitUnavailableError) {
      return new NextResponse(error.message, { status: error.status });
    }
    return new NextResponse('Failed to download file', { status: 502 });
  }
}
