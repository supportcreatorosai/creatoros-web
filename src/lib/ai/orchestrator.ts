import { AIProvider, AIRequestModel, AIRequestSchema, AIResponseModel, GeneratedLesson, LessonSchema } from "./types";
import { GeminiProvider } from "./providers/gemini";
import { OllamaProvider } from "./providers/ollama";
import { parseSlides, type VideoSlide } from "@/lib/video/slides";

export function parseLesson(text: string): GeneratedLesson {
  const json = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return LessonSchema.parse(JSON.parse(json));
}

export class AIOrchestrator {
  async resolveProviders(): Promise<AIProvider[]> {
    const names = [process.env.AI_PROVIDER || "gemini", process.env.AI_FALLBACK_PROVIDER || "ollama"];
    return [...new Set(names.map(name => name.toLowerCase()))].flatMap((name): AIProvider[] => {
      if (name === "gemini") return [new GeminiProvider()];
      if (name === "ollama") return [new OllamaProvider()];
      return [];
    });
  }

  private async generate(request: AIRequestModel, validate?: (text: string) => void): Promise<AIResponseModel> {
    const parsed = AIRequestSchema.safeParse(request);
    if (!parsed.success) {
      return { provider: "gemini", model: "unknown", text: "", success: false, duration: 0, error: "Invalid AI request.", errorCategory: "INVALID_REQUEST" };
    }
    const configuredTimeout = Number(process.env.AI_TIMEOUT_MS || 30000);
    const timeoutMs = Number.isFinite(configuredTimeout) ? Math.max(1000, Math.min(configuredTimeout, 120000)) : 30000;
    const started = Date.now();
    let lastResponse: AIResponseModel | undefined;
    for (const provider of await this.resolveProviders()) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const response = await Promise.race([
          (async () => {
            if (!await provider.isAvailable(controller.signal)) return undefined;
            return provider.generateText(parsed.data, controller.signal);
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error("TIMEOUT")); }, timeoutMs);
          }),
        ]);
        if (!response) continue;
        lastResponse = response;
        if (!response.success) continue;
        if (!response.text.trim()) {
          lastResponse = { ...response, success: false, error: "AI returned an empty response.", errorCategory: "INVALID_RESPONSE" };
          continue;
        }
        try {
          validate?.(response.text);
          return response;
        } catch {
          lastResponse = { ...response, success: false, error: "AI returned an invalid lesson. Please try again.", errorCategory: "INVALID_RESPONSE" };
        }
      } catch (error) {
        const timedOut = error instanceof Error && error.message === "TIMEOUT";
        lastResponse = {
          provider: provider.getProviderName(), model: "unknown", text: "", success: false, duration: Date.now() - started,
          error: timedOut ? "AI generation timed out. Please try again." : "AI generation is temporarily unavailable.",
          errorCategory: timedOut ? "TIMEOUT" : "PROVIDER_UNAVAILABLE",
        };
      } finally {
        if (timer) clearTimeout(timer);
        controller.abort();
      }
    }
    return lastResponse || { provider: "gemini", model: "unknown", text: "", success: false, duration: Date.now() - started, error: "No configured AI provider is available.", errorCategory: "PROVIDER_UNAVAILABLE" };
  }

  async generateRaw(request: AIRequestModel): Promise<AIResponseModel> {
    return this.generate(request);
  }

  async generateSlides(request: AIRequestModel): Promise<{ data?: VideoSlide[]; response: AIResponseModel }> {
    const response = await this.generate({ ...request, task: "script_generation", responseFormat: "json" }, parseSlides);
    return response.success ? { data: parseSlides(response.text), response } : { response };
  }

  async generateStructuredLesson(request: AIRequestModel): Promise<{ data?: GeneratedLesson; response: AIResponseModel }> {
    const response = await this.generate({ ...request, task: "lesson_generation", responseFormat: "json" }, parseLesson);
    return response.success ? { data: parseLesson(response.text), response } : { response };
  }
}

export const aiOrchestrator = new AIOrchestrator();
