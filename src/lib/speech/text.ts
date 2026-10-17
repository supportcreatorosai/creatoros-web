/** Keep short utterances to avoid speech engines stalling on long scripts. */
export function splitSpeechText(text: string, limit = 180): { text: string; offset: number }[] {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("Chunk length must be a positive integer.");
  const chunks: { text: string; offset: number }[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + limit, text.length);
    if (end < text.length) {
      const space = text.lastIndexOf(" ", end);
      if (space > offset + limit / 2) end = space;
    }
    chunks.push({ text: text.slice(offset, end), offset });
    offset = end;
  }
  return chunks;
}
