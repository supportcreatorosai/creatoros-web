import { AIProvider, AIProviderName, AIRequestModel, AIResponseModel } from "../types";

export class OpenClawProvider implements AIProvider {
  
  async isAvailable(): Promise<boolean> {
    return true; // Always available as a reliable fallback!
  }

  getProviderName(): AIProviderName {
    return "openclaw";
  }

  async generateText(request: AIRequestModel): Promise<AIResponseModel> {
    let text = "";
    
    if (request.task === "lesson_generation") {
      text = JSON.stringify({
        title: "Mock Lesson via OpenClaw",
        introduction: "This is a mock lesson because the real AI is unavailable. OpenClaw stepped in!",
        learningObjectives: ["Understand fallback mechanisms", "Appreciate OpenClaw Mock Provider"],
        sections: [
          { heading: "What is OpenClaw?", content: "OpenClaw is our ultimate mock fallback provider ensuring your app never breaks." }
        ],
        examples: ["Example of a fallback in action"],
        keyPoints: ["OpenClaw always works!"],
        summary: "This was a great mock lesson demonstrating resilience.",
        questions: ["How did OpenClaw save the day?"]
      });
    } else {
      text = `This is a mock response from OpenClaw for the task: ${request.task}. Your prompt was received successfully!`;
    }

    return {
      provider: this.getProviderName(),
      model: "openclaw-mock-v1",
      text,
      success: true,
      duration: 150,
      usage: {
        inputTokens: 10,
        outputTokens: 50,
        totalTokens: 60
      }
    };
  }
}
