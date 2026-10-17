import { NextResponse } from 'next/server';
import { getCustomUser } from '@/lib/auth/session';
import { aiOrchestrator } from '@/lib/ai/orchestrator';
import { AIRequestSchema } from '@/lib/ai/types';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit, RateLimitError, RateLimitUnavailableError } from '@/lib/security/rate-limit';
import { isSameOriginRequest } from '@/lib/security/validation';
import { readJsonBody, RequestBodyError } from '@/lib/security/body';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({success:false,error:'Request origin is not permitted.'},{status:403});
  try {
    const { data: { user } } = await getCustomUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized access. Please log in.",
          errorCategory: "AUTHENTICATION_ERROR",
          provider: "unknown",
          model: "unknown",
          duration: 0
        },
        { status: 401 }
      );
    }

    const body = await readJsonBody(request,50000);
    const parsed = AIRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid generation request. Check task, prompt, and generation limits.",
          errorCategory: "INVALID_REQUEST",
          provider: "unknown",
          model: "unknown",
          duration: 0
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    await enforceRateLimit(supabase, "ai-generate", 20, 3600);
    const response = await aiOrchestrator.generateRaw(parsed.data);

    return NextResponse.json(response, { status: response.success ? 200 : response.errorCategory === "TIMEOUT" ? 504 : 503 });
  } catch (error) {
    if (error instanceof RateLimitError || error instanceof RateLimitUnavailableError || error instanceof RequestBodyError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error("[API /api/ai/generate] Unexpected Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected server error occurred.",
        errorCategory: "UNKNOWN_ERROR",
        provider: "unknown",
        model: "unknown",
        duration: 0
      },
      { status: 500 }
    );
  }
}
