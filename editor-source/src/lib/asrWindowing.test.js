import test from 'node:test';
import assert from 'node:assert/strict';
import {planAsrWindows,mergeAsrWindowWords,transcribeInShortWindows} from './asrWindowing.js';
const word=(text,start,end)=>({text:` ${text}`,timestamp:[start,end]});
test('windows cover samples once in their cores and bound padded input to 24 seconds',()=>{
  const audio=new Float32Array(16000*58).fill(.2);
  audio.fill(0,16000*22.8,16000*23.7);
  audio.fill(0,16000*39.2,16000*39.7);
  const windows=planAsrWindows(audio);
  assert.equal(windows[0].coreStart,0);assert.equal(windows.at(-1).coreEnd,58);
  assert.equal(windows[0].coreEnd,23.25);
  assert.equal(windows[0].end,windows[1].start,'a real quiet boundary shares no speech samples');
  windows.forEach((w,i)=>{assert.ok(w.end-w.start<=24.000001);if(i)assert.equal(w.coreStart,windows[i-1].coreEnd);assert.ok(w.start<=w.coreStart&&w.end>=w.coreEnd);});
});
test('unmatched overlapping words fail explicitly instead of being silently discarded',()=>{
  assert.throws(()=>mergeAsrWindowWords([
    {window:{coreStart:0,start:0},chunks:[word('primeira',19.8,20.1)]},
    {window:{coreStart:20,start:19.65},chunks:[word('segunda',19.9,20.3)]},
  ]),{code:'CAPTION_WORD_ALIGNMENT_REQUIRED'});
});
test('overlap matching removes duplicate recognition while preserving spoken repeated words',()=>{
  const result=mergeAsrWindowWords([
    {window:{coreStart:0,start:0},chunks:[word('sim',19,19.2),word('sim',19.5,19.7),word('agora',19.9,20.15)]},
    {window:{coreStart:20,start:19.65},chunks:[word('agora',19.92,20.17),word('vamos',20.2,20.5)]},
  ]);
  assert.deepEqual(result.map(c=>c.text.trim()),['sim','sim','agora','vamos']);
});
test('window offsets are applied exactly once and phrase mode retains real grouped timings',async()=>{
  let calls=0;
  const output=await transcribeInShortWindows(async()=>({chunks:[word('olá',1,1.2),word('mundo',1.3,1.7)],text:' olá mundo'}),new Float32Array(16000*45).fill(.2),{return_timestamps:true,language:'pt'},{onProgress:()=>calls++});
  assert.equal(calls,3);assert.equal(output.chunks.length,3);
  assert.deepEqual(output.chunks[1],{text:' olá mundo',timestamp:[20.65,21.349999999999998]});
});
test('invalid and phrase-level word timing is rejected without inventing intervals',async()=>{
  for(const chunks of [[word('duas palavras',1,2)],[word('uma',2,3),word('outra',1,2)],[word('uma',0,30)]]){
    await assert.rejects(transcribeInShortWindows(async()=>({chunks}),new Float32Array(16000*10),{return_timestamps:'word'}),{code:'CAPTION_WORD_ALIGNMENT_REQUIRED'});
  }
});
test('dialogue dash normalization preserves the original model interval',async()=>{
  const result=await transcribeInShortWindows(async()=>({chunks:[word('- o',1,2)]}),new Float32Array(16000*3),{return_timestamps:'word'});
  assert.deepEqual(result.chunks,[word('o',1,2)]);
});
