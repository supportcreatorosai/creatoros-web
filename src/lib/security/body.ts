export class RequestBodyError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** Bound streamed input before allocating/parsing the complete JSON document. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) throw new RequestBodyError('JSON input is required.', 415);
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RequestBodyError('Request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError('JSON input is required.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_,reject) => { timer = setTimeout(() => { void reader.cancel(); reject(new RequestBodyError('Request body timed out.', 408)); }, 10000); });
  try {
    return await Promise.race([deadline, (async () => {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > maxBytes) throw new RequestBodyError('Request is too large.', 413);
        chunks.push(chunk.value);
      }
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new RequestBodyError('Invalid JSON input.', 400); }
    })()]);
  } finally { clearTimeout(timer); await reader.cancel(); }
}
