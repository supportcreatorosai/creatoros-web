import { z } from "zod";

/** One on-screen slide: a heading and short notes, shown while its narration is spoken. */
export const VideoSlideSchema = z.object({
  title: z.string().trim().min(1).max(90),
  points: z.array(z.string().trim().min(1).max(140)).max(4),
  narration: z.string().trim().min(1).max(600),
});
export const VideoSlidesSchema = z.array(VideoSlideSchema).min(1).max(8);
export type VideoSlide = z.infer<typeof VideoSlideSchema>;

/** Keeps explainer videos short enough to render quickly (about a minute of speech). */
export const MAX_SLIDE_NARRATION = 1100;

const clip = (text: string, max: number) => {
  // Lesson text can contain Markdown (**bold**, # headings, `code`); slides and narration need plain words.
  const clean = text.replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sentence = cut.lastIndexOf(". ");
  return sentence > max * 0.5 ? cut.slice(0, sentence + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
};
const firstSentence = (text: string) => clip(text.split(/(?<=[.!?])\s/)[0] ?? text, 220);

export function slidesNarration(slides: VideoSlide[]): string {
  return slides.map(slide => slide.narration).join(" ");
}

/** Trims narration from the end so the whole video stays within the length budget. */
export function fitSlides(slides: VideoSlide[], budget = MAX_SLIDE_NARRATION): VideoSlide[] {
  const fitted: VideoSlide[] = [];
  let used = 0;
  for (const slide of slides) {
    const room = budget - used;
    if (room < 60) break;
    const narration = clip(slide.narration, Math.min(room, 600));
    fitted.push({ ...slide, title: clip(slide.title, 90), points: slide.points.slice(0, 4).map(point => clip(point, 140)), narration });
    used += narration.length + 1;
  }
  return fitted;
}

type LessonLike = { title: string; summary?: string; learningObjectives?: string[]; keyPoints?: string[]; examples?: string[] };

/** Builds a short explainer from a generated lesson without another AI call. */
export function lessonToSlides(lesson: LessonLike): VideoSlide[] {
  const objectives = (lesson.learningObjectives ?? []).slice(0, 3);
  const keyPoints = lesson.keyPoints ?? [];
  const slides: VideoSlide[] = [{
    title: lesson.title,
    points: objectives.map(item => clip(item, 120)),
    narration: `Welcome! Today we're learning about ${lesson.title}. ${lesson.summary ? firstSentence(lesson.summary) : ""}`.trim(),
  }];
  for (let index = 0; index < Math.min(keyPoints.length, 6); index += 3) {
    const group = keyPoints.slice(index, index + 3);
    slides.push({
      title: index === 0 ? "Key points" : "More key points",
      points: group.map(item => clip(item, 120)),
      narration: group.map(item => firstSentence(item)).join(" "),
    });
  }
  const example = lesson.examples?.[0];
  if (example) slides.push({ title: "Example", points: [clip(example, 130)], narration: `Here's an example. ${firstSentence(example)}` });
  slides.push({
    title: "Recap",
    points: keyPoints.slice(0, 3).map(item => clip(item, 90)),
    narration: `That's a quick overview of ${lesson.title}. Review the key points and try the questions in your lesson.`,
  });
  return fitSlides(slides);
}

export const slidePlanPrompt = (budget = MAX_SLIDE_NARRATION) => `Turn the script below into 3 to 6 presentation slides for an explainer video.
Return only JSON: an array of objects with "title" (max 60 characters), "points" (2-4 short notes, max 90 characters each) and "narration" (what the presenter says while the slide is shown, 1-3 sentences, taken from the script).
Together the narrations must cover the script in order and stay under ${budget} characters.

Script:
`;

export function parseSlides(text: string): VideoSlide[] {
  const json = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(json);
  return VideoSlidesSchema.parse(Array.isArray(parsed) ? parsed : parsed.slides);
}
