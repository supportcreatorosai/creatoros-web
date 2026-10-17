import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaFetcher, isPublicAddress } from '../src/lib/security/safe-fetch.ts';
import { safeRedirectPath, sanitizeFilename, isSameOriginRequest } from '../src/lib/security/validation.ts';
import { enforceRateLimit, RateLimitError, RateLimitUnavailableError } from '../src/lib/security/rate-limit.ts';
import { securityHeaders } from '../src/lib/security/headers.ts';
import { registerSchema, verificationSchema, hasVerifiedEmail } from '../src/lib/auth/validation.ts';
import { AIRequestSchema } from '../src/lib/ai/types.ts';

const publicAddress = { address: '93.184.216.34', family: 4 };
function fixture(extra = {}) {
  return createMediaFetcher({ hosts: ['media.example.com'], resolve: async () => [publicAddress], ...extra });
}
function response(body, headers = {}, status = 200) {
  return { status, headers: { 'content-type': 'video/mp4', ...headers }, body: (async function* () { for (const chunk of body) yield Buffer.from(chunk); })(), cancel() {} };
}

test('SSRF: private, loopback, metadata, mapped, reserved and multicast addresses are denied', () => {
  for (const ip of ['0.0.0.0','10.0.0.1','100.64.0.1','127.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','198.18.0.1','224.0.0.1','255.255.255.255','::','::1','::ffff:127.0.0.1','::ffff:192.168.1.1','fc00::1','fe80::1','fec0::1','ff02::1','2001:db8::1','2002:7f00:1::']) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ['93.184.216.34','8.8.8.8','2606:4700:4700::1111']) assert.equal(isPublicAddress(ip), true, ip);
});
test('SSRF: URL schemes, credentials, IP encodings, ports and host confusion are rejected before transport', async () => {
  let calls = 0;
  const client = fixture({ transport: async () => { calls++; return response(['data']); } });
  for (const url of ['http://media.example.com/v','file:///etc/passwd','data:text/html,hello','https://127.0.0.1/v','https://2130706433/v','https://0x7f000001/v','https://[::1]/v','https://media.example.com@evil.example/v','https://media.example.com.evil.example/v','https://media.example.com:444/v','https://user:pass@media.example.com/v','https://media.example.com\\@evil.example/v','https://media.example.com/v\r\nInjected: true']) await assert.rejects(client.fetchMedia(url));
  assert.equal(calls,0);
});
test('SSRF: DNS containing any private answer is denied; public address is pinned to transport', async () => {
  let used;
  const denied = fixture({ resolve: async () => [publicAddress,{address:'127.0.0.1',family:4}], transport: async () => { throw new Error('must not connect'); } });
  await assert.rejects(denied.fetchMedia('https://media.example.com/v'), /not permitted/);
  const client = fixture({ transport: async (_url,address) => { used=address; return response(['ok']); } });
  assert.equal((await client.fetchMedia('https://media.example.com/v')).buffer.toString(),'ok');
  assert.deepEqual(used,publicAddress);
});
test('SSRF: each redirect is revalidated, including HTTPS downgrade and private-network redirects', async () => {
  for (const location of ['https://127.0.0.1/secret','https://evil.example/v','http://media.example.com/v']) {
    let calls=0;
    const client=fixture({ transport:async()=>{ calls++; return response([], {location},302); } });
    await assert.rejects(client.fetchMedia('https://media.example.com/v'));
    assert.equal(calls,1);
  }
  let calls=0;
  const loop=fixture({transport:async()=>{calls++;return response([],{location:'/again'},302);}});
  await assert.rejects(loop.fetchMedia('https://media.example.com/v'),/Too many/);
  assert.equal(calls,4);
});
test('Resource exhaustion: rejects advertised and streamed oversized bodies, HTML/SVG, and slow servers', async () => {
  await assert.rejects(fixture({transport:async()=>response(['x'],{'content-length':'999'})}).fetchMedia('https://media.example.com/v',{maxBytes:4}),error=>error.status===413);
  await assert.rejects(fixture({transport:async()=>response(['123','456'])}).fetchMedia('https://media.example.com/v',{maxBytes:4}),error=>error.status===413);
  for (const type of ['text/html','image/svg+xml','application/javascript']) await assert.rejects(fixture({transport:async()=>response(['x'],{'content-type':type})}).fetchMedia('https://media.example.com/v'),error=>error.status===415);
  await assert.rejects(fixture({transport:async()=>new Promise(()=>{})}).fetchMedia('https://media.example.com/v',{timeoutMs:10}),error=>error.status===504);
});
test('Open redirect and header injection inputs are normalized or denied', () => {
  for (const input of ['https://evil.example','//evil.example','/\\evil.example','/%2f%2fevil.example','/%252f%252fevil.example','/foo%0d%0aX-Evil:true','/foo\nbar','/%ZZ']) assert.equal(safeRedirectPath(input),'/dashboard',input);
  assert.equal(safeRedirectPath('/dashboard/media?tab=Videos'),'/dashboard/media?tab=Videos');
  const filename=sanitizeFilename('../../file"\r\nX-Evil: 1.mp4');
  assert.equal(/["\r\n\\/]/.test(filename),false);
  assert.ok(sanitizeFilename('a'.repeat(300)).length<=120);
});
test('CSRF: mutation requests need the actual matching origin', () => {
  assert.equal(isSameOriginRequest(new Request('https://creator.example/auth/logout',{headers:{origin:'https://creator.example'}})),true);
  for(const origin of [undefined,'https://evil.example','null']) assert.equal(isSameOriginRequest(new Request('https://creator.example/auth/logout',{headers:origin?{origin}:{}})),false);
});
test('Authentication: client metadata never proves email verification; anonymous users are excluded', () => {
  assert.equal(hasVerifiedEmail({email:'x@example.com',user_metadata:{otp_verified:true}}),false);
  assert.equal(hasVerifiedEmail({email:'x@example.com',email_confirmed_at:'2026-10-09',is_anonymous:true}),false);
  assert.equal(hasVerifiedEmail({email:'x@example.com',email_confirmed_at:'2026-10-09'}),true);
});
test('Signup and OTP inputs require terms, bounded fields, matching passwords and numeric codes', () => {
  const valid={name:'Creator',email:'creator@example.com',password:'testpass123',confirmPassword:'testpass123',terms:true};
  assert.equal(registerSchema.safeParse(valid).success,true);
  for(const values of [{terms:false},{terms:undefined},{name:'x'},{password:'short'},{confirmPassword:'different'},{email:'invalid'},{password:'x'.repeat(257)}]) assert.equal(registerSchema.safeParse({...valid,...values}).success,false);
  assert.equal(verificationSchema.safeParse({email:valid.email,token:'123456'}).success,true);
  for(const token of ['123','<script>','12345678901','12345x']) assert.equal(verificationSchema.safeParse({email:valid.email,token}).success,false);
});
test('Provider payload validation bounds cost and rejects unknown tasks or invalid types', () => {
  assert.equal(AIRequestSchema.safeParse({task:'script_generation',prompt:'hello',temperature:0}).success,true);
  for(const payload of [{task:'admin',prompt:'hello'},{task:'script_generation',prompt:'x'.repeat(10001)},{task:'script_generation',prompt:{}},{task:'script_generation',prompt:'hello',maxTokens:999999},{task:'script_generation',prompt:'hello',temperature:-1}]) assert.equal(AIRequestSchema.safeParse(payload).success,false);
});
test('Rate limits deny exhaustion and fail closed when the database is unavailable', async () => {
  let request;
  await enforceRateLimit({rpc:async(name,args)=>{request={name,args};return {data:true,error:null};}},'video-generate',5,3600);
  assert.equal(request.name,'check_rate_limit');
  await assert.rejects(enforceRateLimit({rpc:async()=>({data:false,error:null})},'video-generate',5,3600),RateLimitError);
  await assert.rejects(enforceRateLimit({rpc:async()=>({data:null,error:{code:'missing'}})},'video-generate',5,3600),RateLimitUnavailableError);
  await assert.rejects(enforceRateLimit({rpc:async()=>{throw new Error('must not call');}},'bad bucket',5,3600),RateLimitUnavailableError);
});
test('Production CSP uses unique nonces, forbids inline scripts/eval, and prevents framing', () => {
  const headers=securityHeaders('abc123==',false,'https://project.supabase.co');
  const scripts=headers['Content-Security-Policy'].split(';').find(v=>v.trim().startsWith('script-src'));
  assert.ok(scripts.includes("'nonce-abc123=='"));
  assert.ok(!scripts.includes('unsafe-inline')&&!scripts.includes('unsafe-eval'));
  assert.equal(headers['X-Frame-Options'],'DENY');
  assert.ok(headers['Content-Security-Policy'].includes("object-src 'none'"));
});
