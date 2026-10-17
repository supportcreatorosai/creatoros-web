import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { pollGeneratedVideo } from '../src/lib/video/poll.ts';
import { splitSpeechText } from '../src/lib/speech/text.ts';
import { RateLimitError, RateLimitUnavailableError } from '../src/lib/security/rate-limit.ts';
import * as slidesModule from '../src/lib/video/slides.ts';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/app/actions/video-actions.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function actionsFixture(overrides = {}) {
  const state = { user: { id: '11111111-1111-4111-8111-111111111111' }, providerCalls: 0, writes: [], ownerJob: null, setupError: null, serviceConfigured: true, rateError: null, key: 'test-key', renderer: null, local: [], uploads: [], removed: [], localStatus: { status: 'done' }, ...overrides };
  function query(service = false) {
    const filters = [];
    return {
      select() { return this; }, eq(key, value) { filters.push([key, value]); return this; }, limit() { return this; },
      async maybeSingle() {
        if (filters.some(([key, value]) => key === 'user_id' && value !== state.user?.id)) throw new Error('Owner filter missing');
        return { data: state.ownerJob, error: null };
      },
      then(resolve, reject) { return Promise.resolve({ data: this.updated ? [{ id: 'updated' }] : [], error: service ? state.setupError : null }).then(resolve, reject); },
      async insert(row) { state.writes.push(row); return { error: null }; },
      update(row) { state.writes.push(row); this.updated = true; return this; },
      is() { return this; },
    };
  }
  const mocks = {
    '@/lib/supabase/server': { createClient: async () => ({ from: () => query(false) }) },
    '@/lib/supabase/service': { createServiceClient: () => { if (!state.serviceConfigured) throw new Error('Missing service key'); return { from: () => query(true) }; } },
    '@/lib/auth/session': { getCustomUser: async () => ({ data: { user: state.user }, error: null }) },
    'next/cache': { revalidatePath() {} },
    'zod': require('zod'),
    '@/lib/security/rate-limit': { RateLimitError, RateLimitUnavailableError, enforceRateLimit: async () => { if (state.rateError) throw state.rateError; } },
    '@/lib/security/safe-fetch': { validateMediaUrl: async raw => new URL(raw), fetchMedia: async url => { if (!state.renderer) throw new Error('Media download was not expected'); state.local.push(['photo', url]); return { buffer: new Uint8Array([0xff, 0xd8, 0xff]), contentType: 'image/jpeg' }; } },
    '@/lib/storage/server': {
      uploadMediaBuffer: async (_client, userId, bytes, type) => { if (!state.renderer) throw new Error('Upload was not expected'); const storagePath = `${userId}/44444444-4444-4444-8444-444444444444.mp4`; state.uploads.push({ storagePath, type, size: bytes.length }); return { storagePath, url: `https://storage.test/sign/${storagePath}` }; },
      signMediaPath: async (_client, userId, path) => `https://storage.test/sign/${path}?token=t`,
      removeMediaPath: async (_client, _userId, path) => { state.removed.push(path); },
      copyMediaPath() { throw new Error('Copy was not expected'); },
    },
    '@/lib/storage/shared': { MAX_MEDIA_BYTES: 50 * 1024 * 1024, assertOwnedMediaPath(path, userId) { if (!path.startsWith(`${userId}/`)) throw new Error('Invalid media path.'); } },
    '@/lib/speech/generate': { generateSpeech: async input => { state.local.push(['speech', input.voice]); state.spoken = input.text; return new Uint8Array([82, 73, 70, 70]); } },
    '@/lib/video/slides': slidesModule,
    '@/lib/ai/orchestrator': { aiOrchestrator: { generateSlides: async () => { state.aiCalls = (state.aiCalls || 0) + 1; return state.slidePlan ?? { response: { success: false } }; } } },
    '@/lib/video/local-renderer': {
      LocalRendererError: class LocalRendererError extends Error {},
      localRenderer: () => state.renderer,
      isLocalJob: id => id.startsWith('local_'),
      submitLocalRender: async (_renderer, input) => { state.local.push(['submit', input.speed, input.image.length]); state.submittedSlides = input.slides; state.submittedFormat = input.format; return `local_${'a'.repeat(32)}`; },
      getLocalRenderStatus: async () => state.localStatus,
      downloadLocalRender: async () => new Uint8Array([0, 0, 0, 24]),
      deleteLocalRender: async (_renderer, id) => { state.local.push(['delete', id]); },
    },
    '@/lib/video/config': {
      VIDEO_FORMATS: { short: { maxScript: 900 }, long: { maxScript: 3000 } },
      MAX_VIDEO_SCRIPT_LENGTH: 3000, MAX_PRESENTER_PHOTO_BYTES: 10 * 1024 * 1024, PRESENTER_PHOTO_STYLE: 'Presenter photo',
      VIDEO_VOICES: [{ id: 'en-US-JennyNeural', geminiVoice: 'Kore', gender: 'female' }, { id: 'en-GB-AbbiNeural', geminiVoice: 'Aoede', gender: 'female' }, { id: 'en-US-GuyNeural', geminiVoice: 'Puck', gender: 'male' }],
      VIDEO_PRESENTERS: [{ name: 'Alice', url: 'https://presenters.test/alice.jpg', gender: 'female', voiceId: 'en-US-JennyNeural' }, { name: 'Adam', url: 'https://presenters.test/adam.png', gender: 'male', voiceId: 'en-US-GuyNeural' }],
    },
  };
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports, require: name => { if (!mocks[name]) throw new Error(`Unexpected import ${name}`); return mocks[name]; },
    process: { env: { D_ID_API_KEY: state.key, GEMINI_API_KEY: state.geminiKey ?? 'gemini-test' } }, Buffer, AbortSignal, console, File, FormData,
    fetch: async (_url, options) => {
      state.providerCalls++;
      state.request = options;
      return { ok: true, status: 200, json: async () => options?.method === 'POST' ? { id: 'tlk_test_job' } : { status: 'done', result_url: 'https://result.d-id.com/test/video.mp4' } };
    },
  });
  return { actions: testModule.exports, state };
}

test('video generate and status deny anonymous users before provider access', async () => {
  const { actions, state } = actionsFixture({ user: null });
  assert.equal((await actions.generateVideoAction('Hello')).success, false);
  assert.equal((await actions.checkVideoStatusAction('tlk_other_user')).success, false);
  assert.equal(state.providerCalls, 0);
});

test('video status denies unknown or other-owner jobs without contacting the provider', async () => {
  const { actions, state } = actionsFixture({ ownerJob: null });
  const result = await actions.checkVideoStatusAction('tlk_other_user');
  assert.equal(result.success, false);
  assert.match(result.error, /not found/);
  assert.equal(state.providerCalls, 0);
});

test('video inputs reject path injection, unbounded scripts, unsupported voices and invalid settings before provider access', async () => {
  const { actions, state } = actionsFixture();
  for (const id of ['../account', 'tlk_test?other=1', '', 'a'.repeat(129)]) assert.equal((await actions.checkVideoStatusAction(id)).success, false);
  for (const options of [null, [], { voiceId: 'made-up-voice' }, { speed: 0 }, { speed: 3 }, { speed: NaN }, { name: 'x'.repeat(151) }]) assert.equal((await actions.generateVideoAction('Hello', undefined, options)).success, false);
  for (const script of ['', ' ', 'x'.repeat(3001), { text: 'Hello' }]) assert.equal((await actions.generateVideoAction(script)).success, false);
  assert.equal(state.providerCalls, 0);
});

test('missing provider credentials, server credentials or database setup fail before billable video generation', async () => {
  for (const overrides of [{ key: undefined }, { serviceConfigured: false }, { setupError: { message: 'missing table' } }]) {
    const { actions, state } = actionsFixture(overrides);
    assert.equal((await actions.generateVideoAction('Hello')).success, false);
    assert.equal(state.providerCalls, 0);
  }
});

test('video rate limits and unavailable protection fail closed before provider access', async () => {
  for (const rateError of [new RateLimitError(), new RateLimitUnavailableError()]) {
    const { actions, state } = actionsFixture({ rateError, ownerJob: { id: 'tlk_owned' } });
    assert.equal((await actions.generateVideoAction('Hello')).success, false);
    assert.equal((await actions.checkVideoStatusAction('tlk_owned')).success, false);
    assert.equal(state.providerCalls, 0);
  }
});

test('successful simulated generation forwards explicit voice/rate and stores only the authenticated owner', async () => {
  const { actions, state } = actionsFixture();
  const result = await actions.generateVideoAction('Hello there', undefined, { voiceId: 'en-GB-AbbiNeural', speed: 1.2, name: 'Course welcome', avatarName: 'Alice' });
  assert.equal(result.success, true);
  const body = JSON.parse(state.request.body);
  assert.equal(body.script.provider.voice_id, 'en-GB-AbbiNeural');
  assert.equal(body.script.provider.voice_config.rate, '1.2');
  assert.equal(state.writes[0].id, result.id);
  assert.equal(state.writes[0].user_id, state.user.id);
  assert.equal(state.writes[0].name, 'Course welcome');
  assert.equal(state.providerCalls, 1);
});

test('video presenters are limited to stock avatars or creator-owned photos', async () => {
  const owner = '11111111-1111-4111-8111-111111111111';
  const photo = `${owner}/22222222-2222-4222-8222-222222222222.jpg`;
  const { actions, state } = actionsFixture();
  for (const [avatarUrl, options] of [['https://attacker.test/face.jpg', {}], [undefined, { photoPath: `33333333-3333-4333-8333-333333333333/22222222-2222-4222-8222-222222222222.jpg` }], [undefined, { photoPath: `${owner}/22222222-2222-4222-8222-222222222222.mp4` }]]) {
    assert.equal((await actions.generateVideoAction('Hello', avatarUrl, options)).success, false);
  }
  assert.equal(state.providerCalls, 0);
  assert.equal((await actions.generateVideoAction('Hello')).success, true);
  assert.equal(JSON.parse(state.request.body).source_url, 'https://presenters.test/alice.jpg');
  assert.equal((await actions.generateVideoAction('Hello', 'https://presenters.test/adam.png')).success, true);
  assert.equal(JSON.parse(state.request.body).source_url, 'https://presenters.test/adam.png');
  assert.equal((await actions.generateVideoAction('Hello', undefined, { photoPath: photo })).success, true);
  assert.equal(JSON.parse(state.request.body).source_url, `https://storage.test/sign/${photo}?token=t`);
});

test('presenter photo uploads reject anonymous users, non-images and oversized files before storage', async () => {
  const form = (bytes, size) => { const data = new FormData(); data.set('photo', new File([bytes], 'me.jpg', { type: 'image/jpeg' })); if (size) Object.defineProperty(data.get('photo'), 'size', { value: size }); return data; };
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  assert.equal((await actionsFixture({ user: null }).actions.uploadPresenterPhotoAction(form(jpeg))).success, false);
  const { actions } = actionsFixture();
  assert.match((await actions.uploadPresenterPhotoAction(form(new TextEncoder().encode('<svg onload=alert(1)>')))).error, /JPG or PNG/);
  assert.match((await actions.uploadPresenterPhotoAction(form(jpeg, 11 * 1024 * 1024))).error, /10 MB/);
  assert.equal((await actions.uploadPresenterPhotoAction(new FormData())).success, false);
});

test('local renderer narrates with Gemini and never calls D-ID, even without D-ID credentials', async () => {
  const { actions, state } = actionsFixture({ renderer: { url: 'http://127.0.0.1:7861', token: 't' }, key: undefined });
  const result = await actions.generateVideoAction('Hello there', 'https://presenters.test/adam.png', { voiceId: 'en-US-GuyNeural', speed: 1.3, name: 'Local' });
  assert.equal(result.success, true);
  assert.equal(result.id, `local_${'a'.repeat(32)}`);
  assert.equal(state.providerCalls, 0);
  assert.deepEqual(state.local, [['photo', 'https://presenters.test/adam.png'], ['speech', 'Puck'], ['submit', 1.3, 3]]);
  assert.equal(state.writes[0].id, result.id);
  assert.equal(state.writes[0].user_id, state.user.id);
});

test('local renderer requires Gemini narration before any render work', async () => {
  const { actions, state } = actionsFixture({ renderer: { url: 'http://127.0.0.1:7861', token: 't' }, geminiKey: '' });
  assert.match((await actions.generateVideoAction('Hello')).error, /GEMINI_API_KEY/);
  assert.deepEqual(state.local, []);
});

test('finished local renders are stored privately once and removed from the renderer', async () => {
  const id = `local_${'a'.repeat(32)}`;
  const { actions, state } = actionsFixture({ renderer: { url: 'http://127.0.0.1:7861', token: 't' }, ownerJob: { id, result_url: null } });
  const result = await actions.checkVideoStatusAction(id);
  assert.equal(result.success, true);
  assert.equal(result.status, 'done');
  assert.equal(state.uploads[0].type, 'video/mp4');
  assert.equal(state.writes[0].result_url, `storage:${state.uploads[0].storagePath}`);
  assert.deepEqual(state.local.at(-1), ['delete', id]);
  assert.equal(state.providerCalls, 0);
});

test('stored local renders are re-signed without contacting the renderer, and queued/failed renders report status', async () => {
  const id = `local_${'b'.repeat(32)}`;
  const owner = '11111111-1111-4111-8111-111111111111';
  const stored = actionsFixture({ ownerJob: { id, result_url: `storage:${owner}/55555555-5555-4555-8555-555555555555.mp4` } });
  const again = await stored.actions.checkVideoStatusAction(id);
  assert.equal(again.status, 'done');
  assert.match(again.videoUrl, /storage\.test\/sign/);
  for (const [localStatus, expected] of [[{ status: 'queued' }, 'created'], [{ status: 'processing' }, 'started'], [{ status: 'error', error: 'No face was found.' }, 'error']]) {
    const { actions, state } = actionsFixture({ renderer: { url: 'http://127.0.0.1:7861', token: 't' }, ownerJob: { id, result_url: null }, localStatus });
    const result = await actions.checkVideoStatusAction(id);
    assert.equal(result.status, expected);
    assert.equal(state.uploads.length, 0);
    if (expected === 'error') assert.equal(result.error_message, 'No face was found.');
  }
});

test('successful simulated status checks persist the owned provider result', async () => {
  const { actions, state } = actionsFixture({ ownerJob: { id: 'tlk_owned' } });
  const result = await actions.checkVideoStatusAction('tlk_owned');
  assert.equal(result.success, true);
  assert.equal(result.videoUrl, 'https://result.d-id.com/test/video.mp4');
  assert.equal(state.writes[0].status, 'done');
  assert.equal(state.writes[0].result_url, result.videoUrl);
});

test('video polling checks sequentially, returns a ready result and reports queued state', async () => {
  let calls = 0;
  let outstanding = 0;
  const statuses = [];
  const result = await pollGeneratedVideo('tlk_owned', async () => {
    assert.equal(++outstanding, 1);
    await new Promise(resolve => setTimeout(resolve, 1));
    outstanding--;
    return ++calls === 2 ? { success: true, status: 'done', videoUrl: 'https://result.d-id.com/video.mp4' } : { success: true, status: 'created' };
  }, { intervalMs: 1, onStatus: value => statuses.push(value) });
  assert.equal(result, 'https://result.d-id.com/video.mp4');
  assert.deepEqual(statuses, ['created']);
});

test('video polling stops on terminal errors and request failures', async () => {
  await assert.rejects(pollGeneratedVideo('id', async () => ({ success: true, status: 'error', error_message: 'Render rejected' })), /Render rejected/);
  await assert.rejects(pollGeneratedVideo('id', async () => ({ success: false, error: 'Not your job' })), /Not your job/);
});

test('video polling abort prevents stale status callbacks and cancels its waiting timer', async () => {
  const controller = new AbortController();
  let callbackCalls = 0;
  await assert.rejects(pollGeneratedVideo('id', async () => {
    controller.abort();
    return { success: true, status: 'created' };
  }, { signal: controller.signal, onStatus: () => callbackCalls++ }), { name: 'AbortError' });
  assert.equal(callbackCalls, 0);
  const waitingController = new AbortController();
  const checking = pollGeneratedVideo('id', async () => ({ success: true, status: 'created' }), { signal: waitingController.signal, intervalMs: 10000 });
  setTimeout(() => waitingController.abort(), 5);
  await assert.rejects(checking, { name: 'AbortError' });
});

test('video polling times out with recovery instructions instead of creating another paid job', async () => {
  await assert.rejects(pollGeneratedVideo('id', async () => ({ success: true, status: 'created' }), { timeoutMs: 5, intervalMs: 1 }), /Check this job again/);
});

test('speech chunking preserves every character and position without empty or oversized chunks', () => {
  for (const text of ['', 'Short script.', 'Long narration. '.repeat(100), 'x'.repeat(1000)]) {
    const chunks = splitSpeechText(text);
    assert.equal(chunks.map(chunk => chunk.text).join(''), text);
    let offset = 0;
    for (const chunk of chunks) {
      assert.ok(chunk.text.length > 0 && chunk.text.length <= 180);
      assert.equal(chunk.offset, offset);
      offset += chunk.text.length;
    }
  }
  assert.throws(() => splitSpeechText('script', 0), RangeError);
});

test('explainer slides drive the narration and reach the local renderer', async () => {
  const { actions, state } = actionsFixture({ renderer: { url: 'http://127.0.0.1:7861', token: 't' } });
  const slides = [{ title: 'Intro', points: ['One', 'Two'], narration: 'Hello there.' }, { title: 'Recap', points: [], narration: 'Goodbye.' }];
  const result = await actions.generateVideoAction('ignored script', undefined, { slides });
  assert.equal(result.success, true);
  assert.equal(state.spoken, 'Hello there. Goodbye.');
  assert.deepEqual(state.submittedSlides, slides);
});

test('malformed or oversized slides are rejected before any render work', async () => {
  const { actions, state } = actionsFixture({ renderer: { url: 'http://127.0.0.1:7861', token: 't' } });
  for (const slides of [[], [{ title: '', points: [], narration: 'x' }], [{ title: 'T', points: ['p', 'p', 'p', 'p', 'p'], narration: 'x' }], Array(9).fill({ title: 'T', points: [], narration: 'x' }), [{ title: 'T', points: [], narration: 'x'.repeat(601) }]]) {
    assert.equal((await actions.generateVideoAction('Hello', undefined, { slides })).success, false);
  }
  assert.deepEqual(state.local, []);
});

test('slide planning requires a signed-in user and a usable AI plan', async () => {
  assert.equal((await actionsFixture({ user: null }).actions.planSlidesAction('A long enough script about plants.')).success, false);
  const { actions, state } = actionsFixture();
  assert.equal((await actions.planSlidesAction('short')).success, false);
  assert.equal(state.aiCalls ?? 0, 0);
  assert.equal((await actions.planSlidesAction('A long enough script about plants and sunlight.')).success, false);
  state.slidePlan = { data: [{ title: 'Plants', points: ['Light'], narration: 'Plants use light.' }], response: { success: true } };
  const planned = await actions.planSlidesAction('A long enough script about plants and sunlight.');
  assert.equal(planned.success, true);
  assert.equal(planned.slides[0].title, 'Plants');
});

test('lesson explainers stay short, ordered and valid for the renderer', () => {
  const lesson = { title: 'Photosynthesis', summary: 'Plants make food from light. More detail follows.', learningObjectives: ['Explain light capture', 'Name the inputs'],
    keyPoints: Array.from({ length: 9 }, (_, index) => `Key point ${index + 1} explains a long idea. `.repeat(8)), examples: ['A leaf in sunlight makes glucose.'] };
  const slides = slidesModule.lessonToSlides(lesson);
  slidesModule.VideoSlidesSchema.parse(slides);
  assert.equal(slides[0].title, 'Photosynthesis');
  assert.ok(slidesModule.slidesNarration(slides).length <= slidesModule.MAX_SLIDE_NARRATION + slides.length);
  assert.ok(slides.every(slide => slide.points.length <= 4));
  assert.deepEqual(slidesModule.parseSlides('```json\n[{"title":"A","points":["b"],"narration":"c"}]\n```'), [{ title: 'A', points: ['b'], narration: 'c' }]);
});

test('short-form videos are limited to about a minute and the format reaches the renderer', async () => {
  const { actions, state } = actionsFixture({ renderer: { url: 'http://127.0.0.1:7861', token: 't' } });
  const tooLong = await actions.generateVideoAction('word '.repeat(200), undefined, { format: 'short' });
  assert.equal(tooLong.success, false);
  assert.match(tooLong.error, /Short-form/);
  assert.deepEqual(state.local, []);
  assert.equal((await actions.generateVideoAction('A quick short.', undefined, { format: 'short' })).success, true);
  assert.equal(state.submittedFormat, 'short');
  assert.equal((await actions.generateVideoAction('word '.repeat(200))).success, true);
  assert.equal(state.submittedFormat, 'long');
  assert.equal((await actions.generateVideoAction('Hello', undefined, { format: 'square' })).success, false);
});

test('stock presenters always speak with a voice of their own gender', async () => {
  const { actions, state } = actionsFixture({ renderer: { url: 'http://127.0.0.1:7861', token: 't' } });
  const mismatch = await actions.generateVideoAction('Hello there', 'https://presenters.test/adam.png', { voiceId: 'en-US-JennyNeural' });
  assert.equal(mismatch.success, false);
  assert.match(mismatch.error, /male voice/);
  assert.equal((await actions.generateVideoAction('Hello there', 'https://presenters.test/alice.jpg', { voiceId: 'en-US-GuyNeural' })).success, false);
  assert.deepEqual(state.local, []);
  assert.equal((await actions.generateVideoAction('Hello there', 'https://presenters.test/adam.png')).success, true);
  assert.deepEqual(state.local.find(entry => entry[0] === 'speech'), ['speech', 'Puck']);
});

test('creators can narrate with their own WAV or MP3 instead of a generated voice', async () => {
  const wav = new Uint8Array(44); wav.set([82, 73, 70, 70], 0); wav.set([87, 65, 86, 69], 8);
  const { actions, state } = actionsFixture({ renderer: { url: 'http://127.0.0.1:7861', token: 't' } });
  const result = await actions.generateVideoAction('', undefined, { audio: new File([wav], 'me.wav', { type: 'audio/wav' }) });
  assert.equal(result.success, true);
  assert.equal(state.local.some(entry => entry[0] === 'speech'), false);
  assert.match((await actions.generateVideoAction('', undefined, { audio: new File([new TextEncoder().encode('<script>')], 'x.mp3') })).error, /WAV or MP3/);
  assert.match((await actions.generateVideoAction('', undefined, { audio: new File([wav], 'me.wav'), slides: [{ title: 'T', points: [], narration: 'x' }] })).error, /Slides need a script/);
  assert.equal((await actions.generateVideoAction('')).success, false);
});
