import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const owner = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const mediaPath = `${owner}/33333333-3333-4333-8333-333333333333.webm`;

function loadModule(path, mocks, globals = {}) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports,
    require: name => { if (!(name in mocks)) throw new Error(`Unexpected import ${name}`); return mocks[name]; },
    Buffer, Blob, Response, DOMException, AbortSignal, setTimeout, clearTimeout,
    console: { error() {} }, ...globals,
  });
  return testModule.exports;
}

function actionsFixture(options = {}) {
  const state = {
    user: { id: owner }, record: { content_type: 'short_video', user_id: owner, script: JSON.stringify({ video_storage_path: mediaPath }) },
    deleted: [], removed: [], inserted: [], ...options,
  };
  const enums = ['lesson', 'short_video', 'long_video', 'social_post'];
  const supabase = { from: () => {
    const filters = [];
    let deleting = false;
    const checkEnum = value => { if (!enums.includes(value)) throw new Error('invalid input value for enum content_type'); };
    return {
      select() { return this; },
      eq(key, value) { if (key === 'content_type') checkEnum(value); filters.push([key, value]); return this; },
      in(key, values) { if (key === 'content_type') values.forEach(checkEnum); return this; },
      async single() {
        assert.ok(filters.some(([key, value]) => key === 'user_id' && value === owner));
        return { data: state.record?.user_id === owner ? state.record : null, error: null };
      },
      delete() { deleting = true; return this; },
      async insert(row) { state.inserted.push(row); return { error: null }; },
      then(resolve, reject) {
        if (deleting) {
          assert.ok(filters.some(([key, value]) => key === 'user_id' && value === owner));
          assert.ok(filters.some(([key, value]) => key === 'content_type' && value === state.record.content_type));
          state.deleted.push(filters);
        }
        return Promise.resolve({ error: null }).then(resolve, reject);
      },
    };
  } };
  const mocks = {
    '@/lib/auth/session': { getCustomUser: async () => ({ data: { user: state.user }, error: null }) },
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@google/genai': { GoogleGenAI: class {} },
    'next/cache': { revalidatePath() {} }, 'zod': require('zod'),
    '@/lib/security/rate-limit': { enforceRateLimit: async () => {}, RateLimitError: class extends Error {}, RateLimitUnavailableError: class extends Error {} },
    '@/lib/security/safe-fetch': { fetchMedia() { throw new Error('Saved render should use its private media path.'); } },
    '@/lib/storage/shared': { assertOwnedMediaPath: (path, userId) => assert.ok(path.startsWith(`${userId}/`)) },
    '@/lib/storage/server': {
      signMediaPath: async (_client, userId, path) => { assert.ok(path.startsWith(`${userId}/`)); return 'https://storage.example/signed.webm'; },
      removeMediaPath: async (_client, userId, path) => { assert.equal(userId, owner); state.removed.push(path); },
      uploadMediaBuffer() { throw new Error('No duplicate upload expected.'); },
    },
  };
  return { state, actions: loadModule('../src/app/actions/caption-actions.ts', mocks) };
}

test('short deletion works with the live enum without sending nonexistent short enum value', async () => {
  const { state, actions } = actionsFixture();
  assert.equal((await actions.deleteShortAction(id)).success, true);
  assert.equal(state.deleted.length, 1);
  assert.deepEqual(state.removed, [mediaPath]);
});

test('short deletion denies other-owner records, other content types, invalid IDs and anonymous sessions', async () => {
  for (const options of [
    { record: { user_id: 'other-user', content_type: 'short_video' } },
    { record: { user_id: owner, content_type: 'lesson' } },
    { user: null },
  ]) {
    const { state, actions } = actionsFixture(options);
    assert.equal((await actions.deleteShortAction(id)).success, false);
    assert.equal(state.deleted.length, 0);
    assert.equal(state.removed.length, 0);
  }
  const { actions, state } = actionsFixture();
  assert.equal((await actions.deleteShortAction('../other-account')).success, false);
  assert.equal(state.deleted.length, 0);
});

test('saving rendered shorts retains private storage and baked captions metadata', async () => {
  const { state, actions } = actionsFixture();
  const result = await actions.saveShortAction({
    title: 'Captioned short', videoStoragePath: mediaPath, hashtags: '#learning',
    scriptData: { captions: [{ word: 'Hello', start: 0, end: 1 }], selectedStyle: 'Minimal', captionsBurned: true },
  });
  assert.equal(result.success, true);
  assert.equal(state.inserted[0].content_type, 'short_video');
  assert.equal(state.inserted[0].user_id, owner);
  const saved = JSON.parse(state.inserted[0].script);
  assert.equal(saved.video_storage_path, mediaPath);
  assert.equal(saved.captionsBurned, true);
});

function rendererFixture(options = {}) {
  const state = { duration: 45, frames: [], words: [], stoppedTracks: 0, closed: 0, resumed: false, revoke: [], ...options };
  const track = () => ({ stop() { state.stoppedTracks++; } });
  const audioTrack = track();
  const tracks = [track()];
  const stream = { addTrack(value) { tracks.push(value); }, getTracks() { return tracks; } };
  const video = {
    duration: state.duration, videoWidth: 640, videoHeight: 360, currentTime: 0, ended: false,
    set src(_value) { setTimeout(() => this.onloadedmetadata?.(), state.metadataDelay || 0); },
    async play() { if (state.playError) throw new Error('Playback rejected'); }, pause() {}, removeAttribute() {}, load() {},
  };
  class AudioContext {
    destination = {};
    async resume() { state.resumed = true; }
    createMediaElementSource() { return { connect() {} }; }
    createMediaStreamDestination() { return { stream: { getAudioTracks: () => [audioTrack] } }; }
    async close() { state.closed++; }
  }
  class MediaRecorder {
    state = 'inactive';
    static isTypeSupported() { return !state.unsupported; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      state.recordedDuration = video.currentTime;
      this.ondataavailable?.({ data: new Blob(state.empty ? [] : ['encoded-video']) });
      this.onstop?.();
    }
  }
  const globals = {
    window: { AudioContext, MediaRecorder }, MediaRecorder,
    document: { createElement: kind => kind === 'video' ? video : {
      getContext: () => ({ drawImage() { state.frames.push(video.currentTime); }, strokeText() {}, fillText(word) { state.words.push(word); } }),
      captureStream: () => stream,
    } },
    requestAnimationFrame: callback => setTimeout(() => { video.currentTime += 1; callback(); }, state.frameBlocked ? 100000 : 0),
    cancelAnimationFrame: clearTimeout,
    URL: { createObjectURL: () => 'blob:source', revokeObjectURL: url => state.revoke.push(url) },
    fetch: async () => {
      assert.equal(state.resumed, true, 'Audio must resume before fetching the source.');
      return state.fetchError ? new Response('', { status: 500 }) : new Response(new Blob(['source']));
    },
  };
  const renderer = loadModule('../src/lib/video/render-captions.ts', { '../storage/shared': { MAX_MEDIA_BYTES: 50 * 1024 * 1024 } }, globals);
  return { state, render: renderer.renderCaptionedShort };
}

test('shared short renderer truncates long videos, burns captions, preserves audio and returns a storage MIME type', async () => {
  const { state, render } = rendererFixture();
  const result = await render({ videoUrl: 'https://storage.example/source.mp4', captions: [{ word: 'hello', start: 0, end: 14 }], style: 'Alex H.', signal: new AbortController().signal });
  assert.equal(result.type, 'video/webm');
  assert.ok(result.size > 0);
  assert.equal(state.recordedDuration, 15);
  assert.ok(state.frames.every(time => time < 15));
  assert.ok(state.words.includes('HELLO'));
  assert.equal(state.stoppedTracks, 2);
  assert.equal(state.closed, 1);
  assert.deepEqual(state.revoke, ['blob:source']);
});

test('short render failures release audio, recorder tracks and downloaded object URLs', async () => {
  for (const options of [{ playError: true }, { empty: true }, { unsupported: true }]) {
    const { state, render } = rendererFixture(options);
    await assert.rejects(render({ videoUrl: 'https://storage.example/source.mp4', captions: [], style: 'Minimal', signal: new AbortController().signal }));
    assert.equal(state.closed, 1);
    assert.equal(state.stoppedTracks, 2);
    assert.deepEqual(state.revoke, ['blob:source']);
  }
  const { state, render } = rendererFixture({ fetchError: true });
  await assert.rejects(render({ videoUrl: 'https://storage.example/source.mp4', captions: [], style: 'Minimal', signal: new AbortController().signal }), /download/);
  assert.equal(state.closed, 1);
});

test('short recording completes even when a background tab pauses frame callbacks', async () => {
  const { state, render } = rendererFixture({ duration: 0.02, frameBlocked: true });
  const output = await render({ videoUrl: 'blob:source', captions: [], style: 'Minimal', signal: new AbortController().signal });
  assert.ok(output.size > 0);
  assert.equal(state.frames.length, 0);
  assert.equal(state.stoppedTracks, 2);
  assert.equal(state.closed, 1);
});

test('aborting a short render while loading metadata releases audio and downloaded source', async () => {
  const { state, render } = rendererFixture({ metadataDelay: 20 });
  const controller = new AbortController();
  const pending = render({ videoUrl: 'https://storage.example/source.mp4', captions: [], style: 'Minimal', signal: controller.signal });
  setTimeout(() => controller.abort(), 2);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(state.closed, 1);
  assert.deepEqual(state.revoke, ['blob:source']);
  assert.equal(state.frames.length, 0);
});
