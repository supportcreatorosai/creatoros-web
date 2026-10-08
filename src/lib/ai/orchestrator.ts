import { AIProvider, AIRequestModel, AIResponseModel, GeneratedLesson, LessonSchema } from "./types";
import { GeminiProvider } from "./providers/gemini";
import { OllamaProvider } from "./providers/ollama";
import { OpenClawProvider } from "./providers/openclaw";
import { ZodError } from "zod";

export class AIOrchestrator {
  private getProviderInstance(name: string): AIProvider {
    switch (name.toLowerCase()) {
      case "gemini":
        return new GeminiProvider();
      case "ollama":
        return new OllamaProvider();
      case "openclaw":
        return new OpenClawProvider();
      default:
        return new GeminiProvider();
    }
  }

  async resolveProviders(): Promise<AIProvider[]> {
    const configuredProviderName = (process.env.AI_PROVIDER || "gemini").toLowerCase();
    const fallbackProviderName = (process.env.AI_FALLBACK_PROVIDER || "ollama").toLowerCase();

    const order = [configuredProviderName];
    if (fallbackProviderName && fallbackProviderName !== configuredProviderName) {
      order.push(fallbackProviderName);
    }
    
    const all = ["gemini", "ollama", "openclaw"];
    for (const p of all) {
      if (!order.includes(p)) order.push(p);
    }

    return order.map(name => this.getProviderInstance(name));
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms))
    ]);
  }

  async generateRaw(request: AIRequestModel): Promise<AIResponseModel> {
    const providers = await this.resolveProviders();
    const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS || "30000", 10);
    const startTime = Date.now();
    let lastErrorResponse: AIResponseModel | null = null;
    
    for (const provider of providers) {
      if (!(await provider.isAvailable())) {
         continue;
      }
      
      try {
        const response = await this.withTimeout(provider.generateText(request), timeoutMs);
        if (response.success) {
          console.log(`[AI Orchestrator] [${request.task}] Success: ${response.success} | Provider: ${response.provider} | Model: ${response.model} | Duration: ${response.duration}ms${response.errorCategory ? ` | Error: ${response.errorCategory}` : ''}`);
          return response;
        } else {
          lastErrorResponse = response;
          console.warn(`[AI Orchestrator] Provider ${provider.getProviderName()} failed to generate: ${response.error}`);
        }
      } catch (e: unknown) {
        const duration = Date.now() - startTime;
        const isTimeout = e instanceof Error && e.message === "TIMEOUT";
        
        console.error(`[AI Orchestrator] [${request.task}] Failed: Provider: ${provider.getProviderName()} | Duration: ${duration}ms | Error: ${isTimeout ? 'TIMEOUT' : 'UNKNOWN'}`);
        
        lastErrorResponse = {
          provider: provider.getProviderName(),
          model: "unknown",
          text: "",
          success: false,
          duration,
          error: isTimeout ? "The AI generation request timed out. Please try again." : "An unexpected error occurred during generation.",
          errorCategory: isTimeout ? "TIMEOUT" : "UNKNOWN_ERROR"
        };
      }
    }

    if (lastErrorResponse) {
      return lastErrorResponse;
    }

    return {
      provider: "gemini",
      model: "unknown",
      text: "",
      success: false,
      duration: Date.now() - startTime,
      error: "All AI providers failed or are unavailable.",
      errorCategory: "PROVIDER_UNAVAILABLE"
    };
  }

  async generateStructuredLesson(request: AIRequestModel): Promise<{ data?: GeneratedLesson; response: AIResponseModel }> {
    const response = await this.generateRaw({
      ...request,
      task: "lesson_generation"
    });

    if (!response.success) {
      return { response };
    }

    try {
      let rawText = response.text.trim();
      if (rawText.startsWith("```json")) rawText = rawText.substring(7);
      if (rawText.startsWith("```")) rawText = rawText.substring(3);
      if (rawText.endsWith("```")) rawText = rawText.substring(0, rawText.length - 3);
      
      const parsedJson = JSON.parse(rawText.trim());
      const validatedData = LessonSchema.parse(parsedJson);

      return {
        data: validatedData,
        response,
      };
    } catch (e: unknown) {
      let errorMessage = "AI generated invalid JSON data.";
      if (e instanceof ZodError) {
        errorMessage = "AI generated data did not match the expected Lesson structure.";
      }
      
      console.error(`[AI Orchestrator] [lesson_generation] Validation Failed: Provider: ${response.provider} | Error: ${errorMessage}`);
      
      return {
        response: {
          ...response,
          success: false,
          error: errorMessage,
          errorCategory: "INVALID_RESPONSE"
        }
      };
    }
  }
}

export const aiOrchestrator = new AIOrchestrator();
