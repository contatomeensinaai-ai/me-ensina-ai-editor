import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { createTranslator } from '../i18n.js';
const readCode = file => transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{format:'cjs'}).code;
const configContext={module:{exports:{}},require:()=>({})};
vm.runInNewContext(readCode('../config/editor.js'),configContext);
const config=configContext.module.exports;
for (const language of ['pt','en','es']) for (const batch of [false,true]) test(`${language}: new generated ${batch?'batch':'single'} audio uses readable catalog label without changing voice`,async()=>{
 const voice=config.VOICES[0];const commits=[];
 const context={module:{exports:{}},console,Float32Array,require(id){
  if(id==='react')return {useCallback:fn=>fn};
  if(id.includes('config/editor'))return config;
  if(id.includes('modelSources'))return {isModelDownloadError:()=>false};
  if(id.includes('ttsText'))return {splitTextAtSentenceEnd:text=>batch?[text,'Second sentence']: [text],TtsInputError:class extends Error{},isStorageQuotaError:()=>false,isPiperSymbolError:()=>false};
  if(id.includes('baseVoiceSynthesis'))return {synthesizeBaseVoice:async()=>({blob:new Blob(['synthetic contract'])})};
  if(id.includes('openVoiceRuntime'))return {applyVoiceOutputGain:async blob=>blob};
  throw new Error(`Unexpected import ${id}`);
 }};
 vm.runInNewContext(readCode('./useVoiceGeneration.js'),context);
 const d=new Proxy({selectedVoice:voice,script:'User 中文 speech',status:'ready',t:createTranslator(language),commitAudio:async(...args)=>commits.push(args),commitAudioBatch:async(...args)=>commits.push(args)},{get:(o,k)=>k in o?o[k]:()=>{}});
 await context.module.exports.useVoiceGeneration(d)();
 assert.equal(commits.length,1);assert.ok(commits[0][1].startsWith('Qinglan · '));assert.equal(voice.name,'晴岚');
});
