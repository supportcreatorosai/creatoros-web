export type VideoStatusResult = {
  success: boolean;
  status?: string;
  videoUrl?: string | null;
  error?: string;
  error_message?: string | null;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Video status checking stopped.", "AbortError");
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException("Video status checking stopped.", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

/** Sequential checks avoid overlapping requests; abort also stops stale UI updates. */
export async function pollGeneratedVideo(
  id: string,
  check: (id: string) => Promise<VideoStatusResult>,
  options: { signal?: AbortSignal; onStatus?: (status: string) => void; timeoutMs?: number; intervalMs?: number } = {},
): Promise<string> {
  // Self-hosted renders ("local_" jobs) run on a single GPU and can take far longer than D-ID.
  const deadline = Date.now() + (options.timeoutMs ?? (id.startsWith("local_") ? 45 : 5) * 60 * 1000);
  while (Date.now() < deadline) {
    throwIfAborted(options.signal);
    const result = await check(id);
    throwIfAborted(options.signal);
    if (!result.success) throw new Error(result.error || "Could not check video status.");
    if (result.status === "done" && result.videoUrl) return result.videoUrl;
    if (["error", "rejected", "failed"].includes(result.status ?? "")) {
      throw new Error(result.error_message || "The video provider could not render this video.");
    }
    options.onStatus?.(result.status || "processing");
    await delay(options.intervalMs ?? 4000, options.signal);
  }
  throw new Error("Video rendering is taking longer than expected. Check this job again to retrieve the result without starting a new generation.");
}
