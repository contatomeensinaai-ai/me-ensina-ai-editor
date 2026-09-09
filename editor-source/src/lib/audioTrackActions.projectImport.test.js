import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const code = transformSync(readFileSync(new URL('./audioTrackActions.js', import.meta.url), 'utf8'), { format: 'cjs' }).code;
function host() {
  const changes = [], revoked = [];
  const refs = { musicRef: { current: { pause: () => changes.push('pause') } }, musicUrlRef: { current: 'blob:old-music' }, sourceAudioUrlRef: { current: 'blob:old-source' }, currentTimeRef: { current: 0 } };
  const d = new Proxy({ ...refs, script: '', audioSegments: [], t: v => v }, { get: (o, k) => k in o ? o[k] : (...args) => changes.push([k, ...args]) });
  const context = { module: { exports: {} }, crypto: { randomUUID: () => 'new-id' }, URL: { createObjectURL() { throw new Error('allocation'); }, revokeObjectURL: url => revoked.push(url) }, require: id => id.includes('config') ? { MAX_TIMELINE_DURATION_SECONDS: 600 } : { estimateDuration: () => 2 } };
  vm.runInNewContext(code, context);
  return { actions: context.module.exports.createAudioTrackActions(d), changes, revoked, refs };
}
for (const type of ['Audio', 'SourceAudio', 'Music']) test(`${type} adopts prepared URL without allocating`, () => {
  const h = host(), args = [new Blob(['audio']), 2, [], 'name'];
  if (type === 'SourceAudio') args.push('', 0, '', { preparedUrl: 'blob:prepared' });
  else if (type === 'Music') args.push('', { preparedUrl: 'blob:prepared' });
  else args.push({ preparedUrl: 'blob:prepared' });
  assert.doesNotThrow(() => h.actions[`replace${type}`](...args));
  if (type === 'Audio') assert.equal(h.changes.find(([k]) => k === 'setAudioSegments')[1]([])[0].url, 'blob:prepared');
  else assert.equal(h.refs[type === 'Music' ? 'musicUrlRef' : 'sourceAudioUrlRef'].current, 'blob:prepared');
});
for (const type of ['SourceAudio', 'Music']) test(`${type} allocation failure preserves old refs and playback`, () => {
  const h = host(); assert.throws(() => h.actions[`replace${type}`](new Blob(['a']), 2, [], 'name'), /allocation/);
  assert.deepEqual(h.changes, []); assert.deepEqual(h.revoked, []);
  assert.equal(h.refs.musicUrlRef.current, 'blob:old-music'); assert.equal(h.refs.sourceAudioUrlRef.current, 'blob:old-source');
});
