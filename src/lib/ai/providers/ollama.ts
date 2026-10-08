import { AIProvider, AIProviderName, AIRequestModel, AIResponseModel, AIErrorCategory } from "../types";

export class OllamaProvider implements AIProvider {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }

  getProviderName(): AIProviderName {
    return "ollama";
  }

  async generateText(request: AIRequestModel): Promise<AIResponseModel> {
    const startTime = Date.now();
    const modelName = process.env.OLLAMA_MODEL || "llama3";
    
    try {
      const url = `${this.baseUrl}/api/generate`;
      
      let prompt = request.prompt;
      if (request.context) {
        prompt = `Context: ${request.context}\n\n${prompt}`;
      }

      const payload = {
        model: modelName,
        prompt: prompt,
        system: request.systemPrompt,
        stream: false,
        options: {
          temperature: request.temperature || 0.7,
        },
        format: "json",
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Ollama returned status ${res.status}`);
      }

      const data = await res.json();
      const duration = Date.now() - startTime;

      return {
        provider: this.getProviderName(),
        model: modelName,
        text: data.response || "",
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        success: true,
        duration,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      let safeError = "An error occurred with local generation.";
      let errorCategory: AIErrorCategory = "UNKNOWN_ERROR";
      
      if (error instanceof Error) {
        if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
          safeError = "Local AI is unavailable. Please make sure Ollama is running.";
          errorCategory = "PROVIDER_UNAVAILABLE";
        }
      }
      
      return {
        provider: this.getProviderName(),
        model: modelName,
        text: "",
        success: false,
        duration,
        error: safeError,
        errorCategory,
      };
    }
  }
}
