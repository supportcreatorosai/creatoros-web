import { NextResponse } from 'next/server';
import { getCustomUser } from '@/lib/auth/session';
import { aiOrchestrator } from '@/lib/ai/orchestrator';
import { AIRequestModel } from '@/lib/ai/types';

export async function POST(request: Request) {
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

    const body = await request.json();

    if (!body.task || !body.prompt) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields 'task' or 'prompt'.",
          errorCategory: "INVALID_REQUEST",
          provider: "unknown",
          model: "unknown",
          duration: 0
        },
        { status: 400 }
      );
    }

    const aiRequest: AIRequestModel = {
      task: body.task,
      prompt: body.prompt,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      context: body.context
    };

    const response = await aiOrchestrator.generateRaw(aiRequest);

    return NextResponse.json(response);
  } catch (error) {
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
