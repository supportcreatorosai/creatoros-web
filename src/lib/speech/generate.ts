import { z } from 'zod';

export const SpeechRequestSchema = z.object({
  text: z.string().trim().min(1).max(3000),
  voice: z.enum(['Kore', 'Puck', 'Aoede', 'Charon']).default('Kore'),
  style: z.enum(['neutral', 'cheerful', 'calm']).default('neutral'),
});

export function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Buffer {
  if (!pcm.length || pcm.length % 2 || sampleRate < 8000 || sampleRate > 48000) throw new Error('Invalid audio output.');
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, Buffer.from(pcm)]);
}

export function decodeSpeechAudio(data: string, mimeType: string): Buffer {
  if (!data || data.length > 28 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Invalid audio output.');
  const bytes = Buffer.from(data, 'base64');
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('Audio output exceeds the size limit.');
  if (/^audio\/(l16|pcm)(;|$)/i.test(mimeType)) {
    if (!bytes.some(value => value !== 0)) throw new Error('The provider returned silent audio. Try generating again.');
    return pcmToWav(bytes, Number(mimeType.match(/rate=(\d+)/i)?.[1] || 24000));
  }
  if (!/^audio\/(wav|x-wav)(;|$)/i.test(mimeType) || bytes.length <= 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('The provider returned an unsupported audio format.');
  return bytes;
}

export async function generateSpeech(input: z.infer<typeof SpeechRequestSchema>, options: { apiKey: string; model?: string; fetchImpl?: typeof fetch; signal?: AbortSignal }): Promise<Buffer> {
  const parsed = SpeechRequestSchema.parse(input);
  const model = options.model || 'gemini-3.8-flash-tts';
  if (!['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-pro-preview-tts'].includes(model)) throw new Error('The speech model configuration is unsupported.');
  if (!options.apiKey || /[\r\n]/.test(options.apiKey)) throw new Error('Voice generation is not configured.');
  const current = model.startsWith('gemini-3.8-');
  const styles = { neutral: 'clear and natural', cheerful: 'cheerful and friendly', calm: 'calm and relaxed' };
  const response = await (options.fetchImpl || fetch)(current
    ? 'https://generativelanguage.googleapis.com/v1beta/interactions'
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
    signal: options.signal || AbortSignal.timeout(60000),
    body: JSON.stringify(current ? {
      model, store: false,
      input: [{ type: 'user_input', content: [{ type: 'text', text: parsed.text, annotations: [{ type: 'speech_metadata', style: styles[parsed.style] }] }] }],
      response_format: { type: 'audio', mime_type: 'audio/wav' },
      generation_config: { speech_config: [{ voice: parsed.voice }] },
    } : {
      contents: [{ role: 'user', parts: [{ text: `Read in a ${styles[parsed.style]} voice:\n${parsed.text}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: parsed.voice } } } },
    }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 429) throw new Error('The speech provider is busy or its quota is exhausted. Please try again later.');
    if ([400, 401, 403, 404].includes(response.status)) throw new Error('The speech provider could not accept the request. Check the API key, model access and script.');
    throw new Error('Voice generation is temporarily unavailable.');
  }
  if (Number(response.headers.get('content-length')) > 28 * 1024 * 1024) { await response.body?.cancel(); throw new Error('Audio output exceeds the size limit.'); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The speech provider returned an empty response.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 28 * 1024 * 1024) throw new Error('Audio output exceeds the size limit.');
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); }
  const result = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
    steps?: { type?: string; content?: { type?: string; data?: string; mime_type?: string }[] }[];
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
  const block = current ? result.steps?.filter(step => step.type === 'model_output').flatMap(step => step.content || []).findLast(part => part.type === 'audio' && part.data) : undefined;
  const audio = current ? block && { data: block.data, mimeType: block.mime_type || 'audio/wav' }
    : result.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.data)?.inlineData;
  if (!audio?.data || !audio.mimeType) throw new Error('The provider did not return audio. Try a shorter script.');
  return decodeSpeechAudio(audio.data, audio.mimeType);
}
