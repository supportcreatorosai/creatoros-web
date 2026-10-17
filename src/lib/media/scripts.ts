export type LibraryScriptSummary = { key: string; title: string; source: string };
export type LoadedLibraryScript = { title: string; text: string };

const MAX_SCRIPT_LENGTH = 100_000;
const MAX_ITEMS = 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" && value.length <= MAX_SCRIPT_LENGTH
    ? value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim()
    : "";
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.slice(0, MAX_ITEMS).map(text).filter(Boolean) : [];
}

/** Reads the saved script formats without turning storage details or arbitrary JSON into narration. */
export function extractLibraryScript(input: unknown): string {
  if (typeof input === "string") {
    if (input.length > MAX_SCRIPT_LENGTH) return "";
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (/^[{["]/.test(trimmed)) {
      try { return extractLibraryScript(JSON.parse(trimmed)); }
      catch { if (trimmed[0] !== '"') return ""; }
    }
    if (/^(?:https?|blob|data):\S+$/i.test(trimmed)) return "";
    return text(input);
  }
  if (!isRecord(input)) return "";

  let parts: string[] = [];
  if (Array.isArray(input.sections) && (typeof input.introduction === "string" || typeof input.summary === "string")) {
    const sectionText = input.sections.slice(0, 30).flatMap(section =>
      isRecord(section) ? [text(section.heading), text(section.content)].filter(Boolean) : []);
    const labelled = (label: string, value: unknown) => {
      const items = textList(value);
      return items.length ? `${label}\n${items.join("\n")}` : "";
    };
    parts = [
      text(input.title), text(input.introduction), labelled("Learning objectives", input.learningObjectives),
      ...sectionText, labelled("Examples", input.examples), labelled("Key points", input.keyPoints),
      text(input.summary), labelled("Questions", input.questions),
    ];
  } else if (Array.isArray(input.captions)) {
    parts = [input.captions.slice(0, MAX_ITEMS)
      .map(caption => isRecord(caption) ? text(caption.word) : "")
      .filter(Boolean).join(" ").replace(/\s+([,.!?;:])/g, "$1")];
  } else {
    // Some older saved content stores its narration in a named text field.
    const namedText = text(input.script_text) || text(input.text) || text(input.script);
    parts = [namedText ? extractLibraryScript(namedText) : ""];
  }
  const result = parts.filter(Boolean).join("\n\n").trim();
  return result.length <= MAX_SCRIPT_LENGTH ? result : "";
}
