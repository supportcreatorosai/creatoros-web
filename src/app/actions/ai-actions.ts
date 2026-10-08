"use server"

import { createClient } from "@/lib/supabase/server";
import { getCustomUser } from "@/lib/auth/session";
import { aiOrchestrator } from "@/lib/ai/orchestrator";
import { buildLessonRequest, LessonPromptParams } from "@/lib/ai/prompts/lesson";
import { GeneratedLesson } from "@/lib/ai/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const LessonInputSchema = z.object({
  topic: z.string().min(1, "Topic is required").max(100, "Topic is too long"),
  audience: z.string().min(1, "Audience is required").max(100, "Audience is too long"),
  subject: z.string().min(1, "Subject is required").max(100, "Subject is too long"),
  difficulty: z.string().max(50).optional().default("Intermediate"),
  additionalInstructions: z.string().max(1000, "Additional instructions are too long").optional().default(""),
});

export async function generateLessonAction(params: LessonPromptParams) {
  try {
    const validatedParams = LessonInputSchema.safeParse(params);
    if (!validatedParams.success) {
      return { success: false, error: "Invalid input: " + validatedParams.error.issues[0].message };
    }

    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized. Please log in to use the AI generator." };
    }

    const request = buildLessonRequest(validatedParams.data);
    const result = await aiOrchestrator.generateStructuredLesson(request);

    if (!result.response.success) {
      return { success: false, error: result.response.error };
    }

    if (!result.data) {
      return { success: false, error: "AI generated an empty or invalid response." };
    }

    return { 
      success: true, 
      data: result.data,
      providerInfo: {
        provider: result.response.provider,
        model: result.response.model,
        duration: result.response.duration
      }
    };
  } catch (error: unknown) {
    console.error("Generate Lesson Action Error:", error);
    return { success: false, error: "An unexpected error occurred during generation." };
  }
}

export async function saveLessonAction(lesson: GeneratedLesson, topic: string) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    const { error: insertError } = await supabase
      .from("content")
      .insert({
        user_id: user.id,
        title: lesson.title,
        topic: topic,
        description: lesson.summary,
        script: JSON.stringify(lesson),
        status: "ready",
        content_type: "lesson",
        platform: "general",
      });

    if (insertError) {
      console.error("Insert Error:", insertError);
      return { success: false, error: "Failed to save lesson to content library." };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    console.error("Save Lesson Action Error:", error);
    return { success: false, error: "An unexpected error occurred while saving." };
  }
}

export async function getLessonByIdAction(id: string) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Fetch Lesson Error:", error);
      return { success: false, error: "Failed to fetch lesson." };
    }

    if (!data) {
      return { success: false, error: "Lesson not found." };
    }

    return { success: true, lesson: data };
  } catch (error: unknown) {
    console.error("Get Lesson Action Error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function deleteLessonAction(id: string) {
  try {
    const { data: { user }, error: authError } = await getCustomUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("content")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Delete Lesson Error:", error);
      return { success: false, error: "Failed to delete lesson." };
    }

    revalidatePath("/dashboard/media");
    return { success: true };
  } catch (error: unknown) {
    console.error("Delete Lesson Action Error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
