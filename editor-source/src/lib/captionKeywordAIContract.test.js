import test from 'node:test';
import assert from 'node:assert/strict';
import {parseKeywordSuggestions,validateCaptionTexts} from './captionKeywordAIContract.js';
const captions=['Codex e Claude Code fazem edição com IA.', 'Comenta "segunda" na live.'];
test('literal Portuguese terms and expressions are preserved and deduplicated',()=>{
 assert.deepEqual(parseKeywordSuggestions('{"keywords":["Codex","Claude Code","edição","IA","Codex"]}',captions),['Codex','Claude Code','edição','IA']);
});
test('rejects hallucinations, changed case and partial word matches',()=>{
 for(const word of ['ChatGPT','codex','laude','edi'])assert.throws(()=>parseKeywordSuggestions(JSON.stringify({keywords:[word]}),captions),/literalmente/);
});
test('rejects invalid JSON and oversized or wrong typed output',()=>{
 assert.throws(()=>parseKeywordSuggestions('```json\n{}\n```',captions),/JSON inválido/);
 for(const keywords of [[4],[''],[' Codex'],['a b c d e'],Array(11).fill('Codex')])assert.throws(()=>parseKeywordSuggestions(JSON.stringify({keywords}),captions));
 assert.deepEqual(parseKeywordSuggestions('{"keywords":[]}',captions),[]);
});
test('bounds input before any request and rejects empty captions',()=>{
 for(const input of [[],[''],['a'.repeat(12001)],Array(101).fill('caption'),[4]])assert.throws(()=>validateCaptionTexts(input));
});
test('validation errors follow the UI language without translating caption data',()=>{
 assert.throws(()=>validateCaptionTexts([], 'en'),/Send between 1 and 100/);
 assert.throws(()=>validateCaptionTexts([], 'es'),/Envía entre 1 y 100/);
 assert.throws(()=>parseKeywordSuggestions('invalid',captions,'en'),/invalid JSON/);
 assert.throws(()=>parseKeywordSuggestions('{"keywords":["ausente"]}',captions,'es'),/no aparece literalmente/);
 assert.deepEqual(parseKeywordSuggestions('{"keywords":["edição"]}',captions,'en'),['edição']);
});
test('all validation branches use the requested language and unsupported locales fall back to Portuguese',()=>{
 assert.throws(()=>validateCaptionTexts(['a'.repeat(12001)],'en'),/12,000-character/);
 assert.throws(()=>parseKeywordSuggestions('{"keywords":[4]}',captions,'en'),/invalid words/);
 assert.throws(()=>parseKeywordSuggestions('{}',captions,'es'),/hasta 10/);
 assert.throws(()=>validateCaptionTexts([], 'fr'),/Envie/);
});
