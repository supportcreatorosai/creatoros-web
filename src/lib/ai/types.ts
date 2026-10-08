import { z } from "zod";

export type AIProviderName = "gemini" | "ollama" | "openclaw";

export type AITaskType = 
  | "lesson_generation" 
  | "script_generation" 
  | "caption_generation" 
  | "hashtag_generation" 
  | "thumbnail_prompt" 
  | "voice_script";

export type AIErrorCategory = 
  | "AUTHENTICATION_ERROR" 
  | "PROVIDER_UNAVAILABLE" 
  | "INVALID_API_KEY" 
  | "RATE_LIMITED" 
  | "TIMEOUT" 
  | "INVALID_REQUEST" 
  | "INVALID_RESPONSE" 
  | "MODEL_NOT_FOUND" 
  | "UNKNOWN_ERROR";

export interface AIRequestModel {
  task: AITaskType;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  context?: string;
}

export interface AIResponseModel {
  provider: AIProviderName;
  model: string;
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  duration: number; // in milliseconds
  success: boolean;
  error?: string;
  errorCategory?: AIErrorCategory;
}

export interface AIProvider {
  generateText(request: AIRequestModel): Promise<AIResponseModel>;
  isAvailable(): Promise<boolean>;
  getProviderName(): AIProviderName;
}

// Structured schema for Lesson Generator
export const LessonSchema = z.object({
  title: z.string().describe("The title of the lesson"),
  introduction: z.string().describe("An engaging introduction to the lesson"),
  learningObjectives: z.array(z.string()).describe("List of learning objectives"),
  sections: z.array(
    z.object({
      heading: z.string().describe("Section heading"),
      content: z.string().describe("The educational content for this section"),
    })
  ).describe("Main explanatory sections of the lesson"),
  examples: z.array(z.string()).describe("Examples to illustrate the topic"),
  keyPoints: z.array(z.string()).describe("Key takeaways or points to remember"),
  summary: z.string().describe("A summary concluding the lesson"),
  questions: z.array(z.string()).describe("Assessment or thought-provoking questions"),
  teachingTips: z.array(z.string()).optional().describe("Optional teaching tips for the educator"),
});

export type GeneratedLesson = z.infer<typeof LessonSchema>;
