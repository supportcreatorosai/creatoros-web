import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechRequestSchema, pcmToWav, decodeSpeechAudio, generateSpeech } from '../src/lib/speech/generate.ts';
import { assertOwnedMediaPath } from '../src/lib/storage/shared.ts';

const input = {text:'Hello from CreatorOS.',voice:'Kore',style:'neutral'};
const pcm = Buffer.from([0,0,10,1,20,2,10,1]);
test('voice output wraps PCM as playable 24kHz mono PCM WAV', () => {
  const wav = pcmToWav(pcm);
  assert.equal(wav.toString('ascii',0,4),'RIFF');
  assert.equal(wav.toString('ascii',8,12),'WAVE');
  assert.equal(wav.readUInt32LE(24),24000);
  assert.equal(wav.readUInt16LE(34),16);
  assert.equal(wav.readUInt32LE(40),pcm.length);
  assert.deepEqual(wav.subarray(44),pcm);
  assert.deepEqual(decodeSpeechAudio(pcm.toString('base64'),'audio/L16;rate=24000'),wav);
  assert.deepEqual(decodeSpeechAudio(wav.toString('base64'),'audio/wav'),wav);
});
test('voice payloads reject empty/oversized scripts, unsupported voices, HTML audio and silent PCM', () => {
  for(const patch of [{text:''},{text:'a'.repeat(3001)},{voice:'../../admin'},{style:'<script>'}]) assert.equal(SpeechRequestSchema.safeParse({...input,...patch}).success,false);
  assert.throws(()=>decodeSpeechAudio(Buffer.from('<script>alert(1)</script>').toString('base64'),'text/html'));
  assert.throws(()=>decodeSpeechAudio(Buffer.alloc(100).toString('base64'),'audio/L16;rate=24000'),/silent/);
  assert.throws(()=>pcmToWav(Buffer.from([1])));
});
test('real TTS contract uses audio-only generation and returns a playable WAV (mock transport)', async () => {
  let request;
  const wav=pcmToWav(pcm);
  const output=await generateSpeech(input,{apiKey:'test-key',fetchImpl:async(url,options)=>{
    request={url,options};return Response.json({steps:[{type:'model_output',content:[{type:'audio',data:wav.toString('base64'),mime_type:'audio/wav'}]}]});
  }});
  assert.deepEqual(output,wav);
  assert.ok(request.url.endsWith('/v1beta/interactions'));
  const body=JSON.parse(request.options.body);
  assert.equal(body.model,'gemini-3.8-flash-tts');
  assert.equal(body.store,false);
  assert.equal(body.input[0].content[0].text,input.text);
  assert.equal(body.generation_config.speech_config[0].voice,'Kore');
  assert.deepEqual(body.response_format,{type:'audio',mime_type:'audio/wav'});
});

test('older configured TTS models retain their audio-only generateContent contract',async()=>{
  let request;
  const output=await generateSpeech(input,{apiKey:'test-key',model:'gemini-3.1-flash-tts-preview',fetchImpl:async(url,options)=>{
    request={url,options};return Response.json({candidates:[{content:{parts:[{inlineData:{data:pcm.toString('base64'),mimeType:'audio/L16;rate=24000'}}]}}]});
  }});
  assert.deepEqual(output,pcmToWav(pcm));
  assert.ok(request.url.endsWith('/gemini-3.1-flash-tts-preview:generateContent'));
  const body=JSON.parse(request.options.body);
  assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,'Kore');
  assert.deepEqual(body.generationConfig.responseModalities,['AUDIO']);
});
test('TTS errors and quota failure never report successful audio', async () => {
  for(const status of [400,401,403,404,429,500]) await assert.rejects(generateSpeech(input,{apiKey:'test-key',fetchImpl:async()=>new Response('{}',{status})}));
  await assert.rejects(generateSpeech(input,{apiKey:'test-key',fetchImpl:async()=>Response.json({candidates:[]})}),/did not return audio/);
  await assert.rejects(generateSpeech(input,{apiKey:'test-key',model:'https://evil.example',fetchImpl:async()=>{throw new Error('must not contact');}}),/unsupported/);
});
test('private storage paths prevent cross-user references and traversal',()=>{
  const owner='11111111-1111-4111-8111-111111111111';
  const path=`${owner}/22222222-2222-4222-8222-222222222222.wav`;
  assert.doesNotThrow(()=>assertOwnedMediaPath(path,owner));
  for(const invalid of [path.replace(owner,'33333333-3333-4333-8333-333333333333'),`${owner}/../secret.wav`,`${owner}/%2e%2e/secret.wav`,`${owner}/22222222-2222-4222-8222-222222222222.svg`]) assert.throws(()=>assertOwnedMediaPath(invalid,owner));
});
