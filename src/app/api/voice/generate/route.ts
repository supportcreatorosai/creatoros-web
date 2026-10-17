import { getCustomUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isSameOriginRequest } from '@/lib/security/validation';
import { enforceRateLimit, RateLimitError, RateLimitUnavailableError } from '@/lib/security/rate-limit';
import { generateSpeech, SpeechRequestSchema } from '@/lib/speech/generate';
import { readJsonBody, RequestBodyError } from '@/lib/security/body';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: 'Request origin is not permitted.' }, { status: 403 });
  const { data: { user } } = await getCustomUser();
  if (!user) return Response.json({ error: 'Please sign in to generate audio.' }, { status: 401 });
  try {
    const body = await readJsonBody(request,16000);
    const input = SpeechRequestSchema.safeParse(body);
    if (!input.success) return Response.json({ error: 'Use a script of 1–3,000 characters and a supported voice.' }, { status: 400 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: 'Voice generation is not configured. Add a Gemini API key.' }, { status: 503 });
    await enforceRateLimit(await createClient(), 'voice-generate', 20, 3600);
    const wav = await generateSpeech(input.data, { apiKey, model: process.env.GEMINI_TTS_MODEL, signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]) });
    return new Response(new Uint8Array(wav), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'attachment; filename="creatoros-voice.wav"' } });
  } catch (error) {
    if (error instanceof RateLimitError || error instanceof RateLimitUnavailableError || error instanceof RequestBodyError) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error && !/fetch|JSON|Unexpected|Abort|timeout/i.test(error.message) ? error.message : 'Voice generation failed or timed out. Please try again.';
    return Response.json({ error: message }, { status: 502 });
  }
}
