import { AIRequestModel } from "../types";

export interface LessonPromptParams {
  topic: string;
  audience: string;
  subject: string;
  difficulty: string;
  additionalInstructions?: string;
}

export function buildLessonRequest(params: LessonPromptParams): AIRequestModel {
  const systemPrompt = `You are an expert educator and instructional designer. 
Your task is to create a well-structured, engaging, and accurate lesson plan.
You MUST respond with ONLY a valid JSON object matching the requested structure. Do not include markdown code block wrappers like \`\`\`json around the response, just return the raw JSON string.

The JSON object MUST have these EXACT keys:
{
  "title": "A catchy title for the lesson",
  "introduction": "An engaging introduction",
  "learningObjectives": ["Objective 1", "Objective 2"],
  "sections": [
    {"heading": "Section 1", "content": "Content of section 1"}
  ],
  "examples": ["Example 1", "Example 2"],
  "keyPoints": ["Key point 1"],
  "summary": "Brief summary",
  "questions": ["Question 1", "Question 2"],
  "teachingTips": ["Tip 1"]
}`;

  const prompt = `Please create a lesson with the following parameters:
- Topic: ${params.topic}
- Class/Audience: ${params.audience}
- Subject: ${params.subject}
- Difficulty: ${params.difficulty}
${params.additionalInstructions ? `- Additional Instructions: ${params.additionalInstructions}` : ''}

Ensure the content is tailored appropriately to the audience and difficulty level.`;

  return {
    task: "lesson_generation",
    prompt,
    systemPrompt,
    temperature: 0.7,
  };
}
