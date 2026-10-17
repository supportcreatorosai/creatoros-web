import { z } from "zod";

export type AIProviderName = "gemini" | "ollama";

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
  responseFormat?: "text" | "json";
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
  generateText(request: AIRequestModel, signal?: AbortSignal): Promise<AIResponseModel>;
  isAvailable(signal?: AbortSignal): Promise<boolean>;
  getProviderName(): AIProviderName;
}

export const AIRequestSchema = z.object({
  task: z.enum(["lesson_generation", "script_generation", "caption_generation", "hashtag_generation", "thumbnail_prompt", "voice_script"]),
  prompt: z.string().trim().min(1).max(10000),
  systemPrompt: z.string().max(10000).optional(),
  context: z.string().max(20000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
  responseFormat: z.enum(["text", "json"]).optional(),
});

// Structured schema for Lesson Generator
export const LessonSchema = z.object({
  title: z.string().trim().min(1).max(300).describe("The title of the lesson"),
  introduction: z.string().min(1).max(10000).describe("An engaging introduction to the lesson"),
  learningObjectives: z.array(z.string().max(2000)).min(1).max(30).describe("List of learning objectives"),
  sections: z.array(
    z.object({
      heading: z.string().min(1).max(300).describe("Section heading"),
      content: z.string().min(1).max(20000).describe("The educational content for this section"),
    })
  ).min(1).max(30).describe("Main explanatory sections of the lesson"),
  examples: z.array(z.string().max(5000)).max(30).describe("Examples to illustrate the topic"),
  keyPoints: z.array(z.string().max(2000)).min(1).max(30).describe("Key takeaways or points to remember"),
  summary: z.string().min(1).max(10000).describe("A summary concluding the lesson"),
  questions: z.array(z.string().max(2000)).max(30).describe("Assessment or thought-provoking questions"),
  teachingTips: z.array(z.string().max(2000)).max(30).optional().describe("Optional teaching tips for the educator"),
});

export type GeneratedLesson = z.infer<typeof LessonSchema>;
