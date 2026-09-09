import test from 'node:test';
import assert from 'node:assert/strict';
import {requestCaptionKeywordSuggestions} from './captionKeywordAI.js';
test('client sends normalized UI language and preserves caption language', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({url, options});
    return {ok: true, json: async () => calls.length === 1 ? {capability: 'local'} : {keywords: ['edição']}};
  });
  assert.deepEqual(await requestCaptionKeywordSuggestions([{text: 'edição com Codex'}], {language: 'en-US'}), ['edição']);
  assert.equal(calls[0].options.headers['X-Timeline-Language'], 'en');
  assert.deepEqual(JSON.parse(calls[1].options.body), {captions: ['edição com Codex'], language: 'en'});
});
test('client localizes connection and malformed response failures', async t => {
  t.mock.method(globalThis, 'fetch', async () => {throw new TypeError('raw network detail');});
  await assert.rejects(requestCaptionKeywordSuggestions([{text:'Codex'}], {language:'es'}), /conexión local/);
  let count = 0;
  globalThis.fetch = async () => ({ok:true, json: async () => {if (++count === 1) return {capability:'local'}; throw new SyntaxError('raw JSON');}});
  await assert.rejects(requestCaptionKeywordSuggestions([{text:'Codex'}], {language:'en'}), /invalid JSON/);
});
test('client preserves AbortError and validates before network', async t => {
  const error = new DOMException('Aborted', 'AbortError');
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {requests++;throw error;});
  await assert.rejects(requestCaptionKeywordSuggestions([], {language:'es'}), /Envía/);
  assert.equal(requests, 0);
  await assert.rejects(requestCaptionKeywordSuggestions([{text:'Codex'}], {language:'en'}), value => value === error);
});
test('cancel while reading JSON preserves cancellation instead of reporting invalid JSON', async t => {
  const error = new DOMException('Aborted', 'AbortError');
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ({ok:true, json:async()=>{if (++calls === 1) return {capability:'local'};throw error;}}));
  await assert.rejects(requestCaptionKeywordSuggestions([{text:'Codex'}],{language:'es'}), value => value === error);
});
