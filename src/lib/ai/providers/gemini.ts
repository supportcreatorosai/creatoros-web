import { GoogleGenAI } from "@google/genai";
import { AIProvider, AIProviderName, AIRequestModel, AIResponseModel, AIErrorCategory } from "../types";

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;
  
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.client = new GoogleGenAI({ apiKey: apiKey || "" });
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.GEMINI_API_KEY;
  }

  getProviderName(): AIProviderName {
    return "gemini";
  }

  async generateText(request: AIRequestModel): Promise<AIResponseModel> {
    const startTime = Date.now();
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    
    try {
      if (!await this.isAvailable()) {
        throw new Error("API_KEY_MISSING");
      }

      let prompt = request.prompt;
      if (request.systemPrompt) {
        prompt = `System Instructions: ${request.systemPrompt}\n\nTask: ${prompt}`;
      }

      if (request.context) {
        prompt = `Context: ${request.context}\n\n${prompt}`;
      }

      const response = await this.client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: request.temperature || 0.7,
          responseMimeType: "application/json",
        }
      });

      const duration = Date.now() - startTime;
      
      // Attempt to extract usage if supported by the SDK, 
      // but standard GoogleGenAI often puts it in response.usageMetadata
      const inputTokens = response.usageMetadata?.promptTokenCount || 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = response.usageMetadata?.totalTokenCount || (inputTokens + outputTokens);

      return {
        provider: this.getProviderName(),
        model: modelName,
        text: response.text || "",
        success: true,
        duration,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens
        }
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      
      let safeError = "AI generation is temporarily unavailable. Please try again.";
      let errorCategory: AIErrorCategory = "UNKNOWN_ERROR";
      
      if (error instanceof Error) {
        if (error.message.includes("API_KEY_MISSING") || error.message.includes("API key not valid")) {
          safeError = "AI generation is temporarily unavailable due to an invalid configuration.";
          errorCategory = "INVALID_API_KEY";
        } else if (error.message.includes("429") || error.message.includes("quota")) {
          safeError = "Rate limit exceeded. Please try again later.";
          errorCategory = "RATE_LIMITED";
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
