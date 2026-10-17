import "server-only";
import type { VideoSlide } from "./slides";

/** Job ids for the self-hosted SadTalker renderer; D-ID ids never use this prefix. */
export const LOCAL_JOB_PREFIX = "local_";
const LOCAL_ID = /^[a-f0-9]{32}$/;

export type LocalRenderer = { url: string; token: string };
export type LocalJobStatus = { status: "queued" | "processing" | "done" | "error"; error?: string | null };

export class LocalRendererError extends Error {}

/** Uses the local renderer when configured, unless VIDEO_PROVIDER explicitly selects D-ID. */
export function localRenderer(): LocalRenderer | null {
  if (process.env.VIDEO_PROVIDER?.trim().toLowerCase() === "d-id") return null;
  const raw = process.env.TALKING_HEAD_URL?.trim();
  const token = process.env.TALKING_HEAD_TOKEN?.trim();
  if (!raw || !token) return null;
  const url = new URL(raw);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // Narration and photos travel to this server, so remote renderers must use HTTPS.
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) throw new LocalRendererError("TALKING_HEAD_URL must use HTTPS unless it is on this machine.");
  return { url: url.origin, token };
}

export function isLocalJob(id: string) {
  return id.startsWith(LOCAL_JOB_PREFIX);
}

function localId(jobId: string) {
  const id = jobId.slice(LOCAL_JOB_PREFIX.length);
  if (!LOCAL_ID.test(id)) throw new LocalRendererError("Invalid local video job.");
  return id;
}

async function call(renderer: LocalRenderer, path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  try {
    return await fetch(`${renderer.url}${path}`, {
      ...init, cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${renderer.token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
    });
  } catch {
    throw new LocalRendererError("The local video renderer is not running. Start it with services/talking-head/start.ps1 and try again.");
  }
}

export async function submitLocalRender(renderer: LocalRenderer, input: { image: Uint8Array; audio: Uint8Array; speed: number; slides?: VideoSlide[]; format?: "short" | "long" }) {
  const response = await call(renderer, "/jobs", {
    method: "POST", timeoutMs: 60_000,
    body: JSON.stringify({ image: Buffer.from(input.image).toString("base64"), audio: Buffer.from(input.audio).toString("base64"), speed: input.speed, ...(input.slides ? { slides: input.slides } : {}), format: input.format ?? "long" }),
  });
  const body: { id?: unknown; error?: unknown } = await response.json().catch(() => ({}));
  if (response.status === 401) throw new LocalRendererError("The local video renderer rejected the app's token. Check TALKING_HEAD_TOKEN in both places.");
  if (!response.ok) throw new LocalRendererError(typeof body.error === "string" ? body.error : "The local video renderer could not accept this job.");
  if (typeof body.id !== "string" || !LOCAL_ID.test(body.id)) throw new LocalRendererError("The local video renderer returned an invalid job.");
  return `${LOCAL_JOB_PREFIX}${body.id}`;
}

export async function getLocalRenderStatus(renderer: LocalRenderer, jobId: string): Promise<LocalJobStatus> {
  const response = await call(renderer, `/jobs/${localId(jobId)}`);
  if (response.status === 404) return { status: "error", error: "The local renderer no longer has this job (it may have restarted). Generate the video again." };
  const body: { status?: unknown; error?: unknown } = await response.json().catch(() => ({}));
  if (!response.ok || !["queued", "processing", "done", "error"].includes(body.status as string)) throw new LocalRendererError("Could not read the local render status.");
  return { status: body.status as LocalJobStatus["status"], error: typeof body.error === "string" ? body.error : null };
}

export async function downloadLocalRender(renderer: LocalRenderer, jobId: string, maxBytes: number) {
  const response = await call(renderer, `/jobs/${localId(jobId)}/video`, { timeoutMs: 120_000 });
  if (!response.ok || response.headers.get("content-type") !== "video/mp4") throw new LocalRendererError("Could not download the rendered video.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > maxBytes) throw new LocalRendererError("The rendered video is too large to store.");
  return bytes;
}

export async function deleteLocalRender(renderer: LocalRenderer, jobId: string) {
  await call(renderer, `/jobs/${localId(jobId)}`, { method: "DELETE" }).catch(() => undefined);
}
