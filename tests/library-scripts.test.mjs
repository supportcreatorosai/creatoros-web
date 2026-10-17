import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { extractLibraryScript } from '../src/lib/media/scripts.ts';

const require = createRequire(import.meta.url);
const owner = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
const contentId = '33333333-3333-4333-8333-333333333333';
const voiceId = '44444444-4444-4444-8444-444444444444';
const otherId = '55555555-5555-4555-8555-555555555555';
const source = fs.readFileSync(new URL('../src/app/actions/library-script-actions.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

const lesson = {
  title: 'Plants', introduction: 'Plants need light.', learningObjectives: ['Describe photosynthesis.'],
  sections: [{ heading: 'Leaves', content: 'Leaves capture sunlight.' }], examples: ['A tree grows.'],
  keyPoints: ['Light gives energy.'], summary: 'Plants make their own food.', questions: ['What do leaves do?'],
  teachingTips: ['Teacher only notes.'], video_url: 'https://example.test/secret.mp4',
};

function fixture(overrides = {}) {
  const state = {
    user: { id: owner }, authError: null, queryError: null, queries: [],
    rows: {
      content: [{ id: contentId, user_id: owner, title: 'Plants', content_type: 'lesson', script: JSON.stringify(lesson), created_at: '2026-10-09T10:00:00Z' }],
      saved_voices: [{ id: voiceId, user_id: owner, name: 'Welcome', script_text: 'Welcome to the course.', created_at: '2026-10-10T10:00:00Z' }],
    }, ...overrides,
  };
  function query(table) {
    const logged = { table, filters: [], selection: '', count: null, order: null };
    state.queries.push(logged);
    function results() {
      assert.ok(logged.filters.some(([key, value]) => key === 'user_id' && value === owner), 'Every read must constrain the authenticated owner');
      let rows = (state.rows[table] || []).filter(row => logged.filters.every(([key, value]) => row[key] === value));
      if (logged.order) rows.sort((a, b) => b[logged.order].localeCompare(a[logged.order]));
      if (logged.count !== null) rows = rows.slice(0, logged.count);
      return rows.map(row => Object.fromEntries(logged.selection.split(',').map(key => key.trim()).map(key => [key, row[key]])));
    }
    return {
      select(value) { logged.selection = value; assert.notEqual(value, '*'); return this; },
      eq(key, value) { logged.filters.push([key, value]); return this; },
      order(key, options) { logged.order = key; assert.equal(options.ascending, false); return this; },
      limit(count) { logged.count = count; assert.ok(count <= 100); return this; },
      then(resolve, reject) { return Promise.resolve({ data: results(), error: state.queryError }).then(resolve, reject); },
      async maybeSingle() { return { data: results()[0] || null, error: state.queryError }; },
    };
  }
  const mocks = {
    '@/lib/auth/session': { getCustomUser: async () => ({ data: { user: state.user }, error: state.authError }) },
    '@/lib/supabase/server': { createClient: async () => ({ from: query }) },
    '@/lib/media/scripts': { extractLibraryScript }, 'zod': require('zod'),
  };
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: testModule, exports: testModule.exports,
    require: name => { if (!mocks[name]) throw new Error(`Unexpected import ${name}`); return mocks[name]; },
  });
  return { actions: testModule.exports, state };
}

test('library extraction turns saved lesson JSON into ordered spoken text and excludes unrelated metadata', () => {
  const result = extractLibraryScript(JSON.stringify(lesson));
  assert.equal(result, 'Plants\n\nPlants need light.\n\nLearning objectives\nDescribe photosynthesis.\n\nLeaves\n\nLeaves capture sunlight.\n\nExamples\nA tree grows.\n\nKey points\nLight gives energy.\n\nPlants make their own food.\n\nQuestions\nWhat do leaves do?');
  for (const unwanted of ['Teacher only', 'secret.mp4', 'video_url', 'learningObjectives', '{']) assert.ok(!result.includes(unwanted));
});

test('library extraction accepts plain scripts and caption words but never narrates storage paths, timings or unknown JSON', () => {
  assert.equal(extractLibraryScript('  Hello.\r\nWelcome!\u0000  '), 'Hello.\nWelcome!');
  assert.equal(extractLibraryScript('"Hello," she said.'), '"Hello," she said.');
  assert.equal(extractLibraryScript(JSON.stringify({ captions: [{ word: 'Hello', start: 0, end: 1 }, { word: ',' }, { word: 'world!' }], video_storage_path: `${owner}/secret.mp4`, selectedStyle: 'bold' })), 'Hello, world!');
  assert.equal(extractLibraryScript({ script_text: 'A saved script.' }), 'A saved script.');
  for (const value of [null, 42, [], {}, '{broken', '{"video_url":"https://example.test/private.mp4"}', { text: '{"video_url":"https://example.test/private.mp4"}' }, 'https://example.test/private.mp4?token=secret', 'x'.repeat(100001)]) assert.equal(extractLibraryScript(value), '');
  assert.equal(extractLibraryScript({ sections: [{ content: 'x'.repeat(100000) }], introduction: 'y' }), '');
});

test('library list returns only bounded metadata for the verified owner and skips empty or media-only records', async () => {
  const { actions, state } = fixture();
  state.rows.content.push(
    { id: otherId, user_id: otherOwner, title: 'Other user secret', script: 'Private narration.', created_at: '2026-10-11T10:00:00Z' },
    { id: otherId, user_id: owner, title: 'Media only', script: '{"video_url":"https://example.test/private.mp4"}', created_at: '2026-10-11T10:00:00Z' },
  );
  const result = await actions.getLibraryScriptsAction();
  assert.equal(result.success, true);
  assert.equal(JSON.stringify(result.scripts), JSON.stringify([
    { key: `voice:${voiceId}`, title: 'Welcome', source: 'Voice script' },
    { key: `content:${contentId}`, title: 'Plants', source: 'Lesson' },
  ]));
  assert.ok(!JSON.stringify(result).includes('Welcome to the course.'));
  assert.ok(state.queries.every(query => query.count === 100));
});

test('anonymous or failed verified sessions cannot list or load scripts and issue no database queries', async () => {
  for (const overrides of [{ user: null }, { authError: new Error('Unverified email') }]) {
    const { actions, state } = fixture(overrides);
    assert.equal((await actions.getLibraryScriptsAction()).success, false);
    assert.equal((await actions.loadLibraryScriptAction(`voice:${voiceId}`)).success, false);
    assert.equal(state.queries.length, 0);
  }
});

test('selected content and voice loads are re-read with ownership checks; forged keys and another owner fail', async () => {
  const { actions, state } = fixture();
  state.rows.content.push({ id: otherId, user_id: otherOwner, title: 'Secret', script: 'Never disclose.' });
  const voice = await actions.loadLibraryScriptAction(`voice:${voiceId}`);
  assert.equal(voice.success, true);
  assert.equal(voice.script.text, 'Welcome to the course.');
  const content = await actions.loadLibraryScriptAction(`content:${contentId}`);
  assert.equal(content.success, true);
  assert.equal(content.script.text, extractLibraryScript(lesson));
  const denied = await actions.loadLibraryScriptAction(`content:${otherId}`);
  assert.equal(denied.success, false);
  assert.ok(!JSON.stringify(denied).includes('Never disclose.'));
  const queryCount = state.queries.length;
  for (const key of ['voice:../secret', `voice:${voiceId}:owner:${otherOwner}`, `profiles:${voiceId}`, `content:${'a'.repeat(36)}`, null, { id: voiceId }]) assert.equal((await actions.loadLibraryScriptAction(key)).success, false);
  assert.equal(state.queries.length, queryCount);
  assert.ok(state.queries.every(query => query.filters.some(([key]) => key === 'id')));
});

test('library actions report database failures and removed or unusable scripts without exposing backend details', async () => {
  const failed = fixture({ queryError: { message: 'Secret database detail' } });
  for (const result of [await failed.actions.getLibraryScriptsAction(), await failed.actions.loadLibraryScriptAction(`voice:${voiceId}`)]) {
    assert.equal(result.success, false);
    assert.ok(!result.error.includes('Secret'));
  }
  const { actions, state } = fixture();
  state.rows.saved_voices[0].script_text = ' ';
  assert.equal((await actions.loadLibraryScriptAction(`voice:${voiceId}`)).success, false);
  assert.equal((await actions.loadLibraryScriptAction(`content:${otherId}`)).success, false);
});
