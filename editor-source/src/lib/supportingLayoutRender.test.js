import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
test('browser and offline export carry absolute timeline time for supporting-image windows',()=>{
 const realtime=readFileSync(new URL('./media.js',import.meta.url),'utf8');const offline=readFileSync(new URL('./offlineVideoExport.js',import.meta.url),'utf8');assert.match(realtime,/timelineTime:\s*finalTimelineTime/);assert.match(offline,/timelineTime:\s*time/);
});
