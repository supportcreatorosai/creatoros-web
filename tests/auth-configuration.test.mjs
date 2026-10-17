import test from 'node:test';
import assert from 'node:assert/strict';
import { emailConfirmationEnabled } from '../src/lib/auth/configuration.ts';

const config = { url: 'https://exampleproject.supabase.co', anonKey: 'public-test-key' };
test('email registration requires explicit provider confirmation and enabled email auth', async () => {
  for (const settings of [{}, { mailer_autoconfirm: true, external: { email: true } }, { mailer_autoconfirm: false, external: { email: false } }, { mailer_autoconfirm: 'false', external: { email: true } }]) {
    assert.equal(await emailConfirmationEnabled({ ...config, fetchImpl: async () => Response.json(settings) }), false);
  }
  assert.equal(await emailConfirmationEnabled({ ...config, fetchImpl: async (url, options) => {
    assert.equal(url.href, `${config.url}/auth/v1/settings`);
    assert.equal(options.headers.apikey, config.anonKey);
    assert.equal(options.cache, 'no-store');
    return Response.json({ mailer_autoconfirm: false, external: { email: true } });
  } }), true);
});
test('email configuration failures and unexpected service destinations fail closed', async () => {
  for (const fetchImpl of [async () => new Response('', { status: 503 }), async () => new Response('invalid JSON'), async () => { throw new Error('timeout'); }]) {
    assert.equal(await emailConfirmationEnabled({ ...config, fetchImpl }), false);
  }
  for (const url of ['http://exampleproject.supabase.co', 'https://evil.example', 'https://exampleproject.supabase.co.evil.example', 'https://127.0.0.1']) {
    assert.equal(await emailConfirmationEnabled({ ...config, url, fetchImpl: async () => { assert.fail('Untrusted destination must not be contacted'); } }), false);
  }
});
