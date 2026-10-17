import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createMediaFetcher, MediaFetchError } from '../src/lib/security/safe-fetch.ts';
import * as validation from '../src/lib/security/validation.ts';
import * as body from '../src/lib/security/body.ts';
import * as rate from '../src/lib/security/rate-limit.ts';
import { SpeechRequestSchema, pcmToWav } from '../src/lib/speech/generate.ts';
import { AIRequestSchema } from '../src/lib/ai/types.ts';

function route(file,overrides={}) {
  const state={user:{id:'test-user'},calls:0,rateError:null,...overrides};
  const mocks={
    'next/server':{NextResponse:Response},
    '@/lib/auth/session':{getCustomUser:async()=>({data:{user:state.user}})},
    '@/lib/supabase/server':{createClient:async()=>({})},
    '@/lib/security/validation':validation,
    '@/lib/security/body':body,
    '@/lib/security/rate-limit':{...rate,enforceRateLimit:async()=>{if(state.rateError)throw state.rateError;}},
    '@/lib/security/safe-fetch':{MediaFetchError,...createMediaFetcher({hosts:['media.example.com'],resolve:async()=>[{address:'93.184.216.34',family:4}],transport:async()=>{state.calls++;throw new Error('No transport expected');}})},
    '@/lib/speech/generate':{SpeechRequestSchema,generateSpeech:async()=>{state.calls++;return pcmToWav(Buffer.from([1,2,3,4]));}},
    '@/lib/ai/types':{AIRequestSchema},
    '@/lib/ai/orchestrator':{aiOrchestrator:{generateRaw:async()=>{state.calls++;return {success:true,text:'test'};}}},
  };
  const testModule={exports:{}};
  const source=fs.readFileSync(new URL(`../src/app/api/${file}/route.ts`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled,{module:testModule,exports:testModule.exports,require:name=>{if(!mocks[name])throw new Error(name);return mocks[name];},URL,Response,Request,AbortSignal,Uint8Array,console,process:{env:{GEMINI_API_KEY:'test-key'}}});
  return {handlers:testModule.exports,state};
}
const jsonRequest=(path,payload,origin='https://creator.example')=>new Request(`https://creator.example/api/${path}`,{method:'POST',headers:{origin,'content-type':'application/json'},body:typeof payload==='string'?payload:JSON.stringify(payload)});
test('download route rejects anonymous requests and authenticated SSRF payloads',async()=>{
  const anonymous=route('download',{user:null});
  assert.equal((await anonymous.handlers.GET(new Request('https://creator.example/api/download?url=https://127.0.0.1'))).status,401);
  const auth=route('download');
  for(const url of ['http://169.254.169.254/latest/meta-data','https://127.0.0.1/','file:///etc/passwd','https://evil.example/']) assert.equal((await auth.handlers.GET(new Request(`https://creator.example/api/download?url=${encodeURIComponent(url)}`))).status,400);
  assert.equal(auth.state.calls,0);
});
test('voice route rejects CSRF, unauthenticated calls, oversized/malformed JSON and invalid voice settings',async()=>{
  const fixture=route('voice/generate');
  assert.equal((await fixture.handlers.POST(jsonRequest('voice/generate',{text:'Hi'},'https://evil.example'))).status,403);
  assert.equal((await route('voice/generate',{user:null}).handlers.POST(jsonRequest('voice/generate',{text:'Hi'}))).status,401);
  for(const [payload,status] of [['{',400],[{text:'a'.repeat(16001)},413],[{text:'Hi',voice:'admin'},400],[{text:''},400]]) assert.equal((await fixture.handlers.POST(jsonRequest('voice/generate',payload))).status,status);
  assert.equal(fixture.state.calls,0);
});
test('voice route fails closed on protection errors and returns actual audio on success (mock provider)',async()=>{
  for(const error of [new rate.RateLimitError(),new rate.RateLimitUnavailableError()]) {
    const fixture=route('voice/generate',{rateError:error});
    assert.equal((await fixture.handlers.POST(jsonRequest('voice/generate',{text:'Hi'}))).status,error.status);
    assert.equal(fixture.state.calls,0);
  }
  const fixture=route('voice/generate');
  const response=await fixture.handlers.POST(jsonRequest('voice/generate',{text:'Hi'}));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'audio/wav');
  assert.equal(Buffer.from(await response.arrayBuffer()).toString('ascii',0,4),'RIFF');
});
test('AI route rejects unauthorized, cross-site, oversized and invalid generation input before provider access',async()=>{
  const fixture=route('ai/generate');
  assert.equal((await fixture.handlers.POST(jsonRequest('ai/generate',{task:'script_generation',prompt:'Hi'},'https://evil.example'))).status,403);
  assert.equal((await route('ai/generate',{user:null}).handlers.POST(jsonRequest('ai/generate',{}))).status,401);
  for(const payload of [{task:'admin',prompt:'Hi'},{task:'script_generation',prompt:'Hi',maxTokens:100000}]) assert.equal((await fixture.handlers.POST(jsonRequest('ai/generate',payload))).status,400);
  assert.equal((await fixture.handlers.POST(jsonRequest('ai/generate',{prompt:'a'.repeat(50001)}))).status,413);
  assert.equal(fixture.state.calls,0);
});
