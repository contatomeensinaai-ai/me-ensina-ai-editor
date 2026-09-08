import assert from 'node:assert/strict';
import test from 'node:test';
import { createProjectAutosaveController } from './useProjectAutosave.js';
import {prepareProjectCheckpoint} from '../lib/projectPersistence.js';
const wait=()=>new Promise(resolve=>setTimeout(resolve,15));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const snapshot=script=>({project:{script},visualSegments:[],audioSegments:[]});

function setup({load=async()=>null,save=prepareProjectCheckpoint,restore=async()=>true}={}) {
 const saved=[];
 const controller=createProjectAutosaveController({store:{load,save:async value=>{saved.push(value.project.script);return save(value);}},restore,delay:3});
 return {controller,saved};
}

test('starts loading and prevents overwriting existing checkpoint until an explicit decision',async()=>{
 const loaded=deferred();const {controller,saved}=setup({load:()=>loaded.promise});
 controller.update(snapshot('blank'));const initialization=controller.initialize();
 assert.equal(controller.getState().status,'loading');await wait();assert.deepEqual(saved,[]);
 loaded.resolve(await prepareProjectCheckpoint(snapshot('precious')));await initialization;
 assert.equal(controller.getState().status,'recovery');await wait();assert.deepEqual(saved,[]);
 controller.discardRecovery();await wait();assert.deepEqual(saved,['blank']);controller.dispose();
});

test('restore awaits complete asynchronous hydration before enabling any autosave',async()=>{
 const hydration=deferred();let archive;
 const checkpoint=await prepareProjectCheckpoint(snapshot('recovered'));
 const {controller,saved}=setup({load:async()=>checkpoint,restore:async value=>{archive=value;await hydration.promise;return true;}});
 controller.update(snapshot('blank'));await controller.initialize();
 const restoring=controller.restoreRecovery();
 controller.update(snapshot('partially restored'));await wait();
 assert.equal(controller.getState().status,'restoring');assert.deepEqual(saved,[]);
 controller.update(snapshot('recovered'));hydration.resolve();await restoring;await wait();
 assert.equal(archive.payload.project.script,'recovered');assert.deepEqual(saved,[]);
 controller.update(snapshot('edited'));await wait();assert.deepEqual(saved,['edited']);controller.dispose();
});

test('failed or false-returning hydration preserves recovery and does not save partial state',async()=>{
 for (const restore of [async()=>false,async()=>{throw new Error('decode failed');}]) {
 const checkpoint=await prepareProjectCheckpoint(snapshot('precious'));
 const {controller,saved}=setup({load:async()=>checkpoint,restore});
 controller.update(snapshot('blank'));await controller.initialize();await controller.restoreRecovery();
 controller.update(snapshot('partial'));await wait();assert.deepEqual(saved,[]);
 assert.equal(controller.getState().status,'error');assert.equal(controller.getState().recovery,checkpoint);controller.dispose();
 }
});

test('debounce saves latest edit, ignores view changes, and saved status waits for completion',async()=>{
 const committed=deferred();const {controller,saved}=setup({save:()=>committed.promise});
 controller.update(snapshot('one'));await controller.initialize();controller.update(snapshot('two'));controller.update(snapshot('three'));
 await wait();assert.deepEqual(saved,['three']);assert.equal(controller.getState().status,'saving');
 committed.resolve(await prepareProjectCheckpoint(snapshot('three')));await wait();assert.equal(controller.getState().status,'saved');
 controller.update({project:{script:'three',currentTime:12,timelineZoom:3},visualSegments:[],audioSegments:[]});await wait();assert.deepEqual(saved,['three']);controller.dispose();
});

test('edits arriving during save are serialized and only newest pending snapshot gets written',async()=>{
 const first=deferred();let calls=0;const {controller,saved}=setup({save:async value=>++calls===1?first.promise:prepareProjectCheckpoint(value)});
 controller.update(snapshot('first'));await controller.initialize();await wait();
 controller.update(snapshot('middle'));controller.update(snapshot('last'));await wait();assert.deepEqual(saved,['first']);
 first.resolve(await prepareProjectCheckpoint(snapshot('first')));await wait();await wait();
 assert.deepEqual(saved,['first','last']);assert.equal(controller.getState().status,'saved');controller.dispose();
});

test('save errors retain previous savedAt and retry latest snapshot without claiming success',async()=>{
 let fail=false;const {controller,saved}=setup({save:async value=>{if(fail)throw new Error('QuotaExceededError');return prepareProjectCheckpoint(value);}});
 controller.update(snapshot('first'));await controller.initialize();await wait();const savedAt=controller.getState().savedAt;
 fail=true;controller.update(snapshot('second'));await wait();
 assert.equal(controller.getState().status,'error');assert.equal(controller.getState().savedAt,savedAt);
 fail=false;controller.retry();await wait();assert.deepEqual(saved,['first','second','second']);assert.equal(controller.getState().status,'saved');controller.dispose();
});

test('unmount cancels pending debounce; load errors never unlock saving implicitly',async()=>{
 const {controller,saved}=setup({load:async()=>{throw new Error('unavailable');}});
 controller.update(snapshot('new'));await controller.initialize();await wait();assert.equal(controller.getState().status,'error');assert.deepEqual(saved,[]);
 controller.dispose();
 const next=setup();next.controller.update(snapshot('new'));await next.controller.initialize();next.controller.dispose();await wait();assert.deepEqual(next.saved,[]);
});

test('undo back to saved content cancels pending write and returns to saved status',async()=>{
 const {controller,saved}=setup();controller.update(snapshot('saved'));await controller.initialize();await wait();
 controller.update(snapshot('unsaved'));controller.update(snapshot('saved'));await wait();
 assert.deepEqual(saved,['saved']);assert.equal(controller.getState().status,'saved');controller.dispose();
});

// Execute the actual hook with a minimal React lifecycle host, including effect replay.
// This validates our effect wiring; it is not a browser or a React renderer substitute.
async function hookHost(initialProps) {
 const [{readFileSync},vm,{transformSync},persistence]=await Promise.all([import('node:fs'),import('node:vm'),import('esbuild'),import('../lib/projectPersistence.js')]);
 const slots=[];const effects=[];let index=0;let pending=[];let props=initialProps;
 const code=transformSync(readFileSync(new URL('./useProjectAutosave.js',import.meta.url),'utf8'),{loader:'js',format:'cjs'}).code;
 const context={module:{exports:{}},setTimeout,clearTimeout,require(id){
  if(id!=='react')return persistence;
  return {
   useRef(value){const slot=index++;return slots[slot]??=( {current:value} );},
   useState(value){const slot=index++;if(!(slot in slots))slots[slot]=value;return [slots[slot],next=>{slots[slot]=next;}];},
   useCallback(fn){return fn;},
   useEffect(setup,deps){const slot=index++;const before=effects[slot];if(!before||!deps||deps.some((value,i)=>value!==before.deps?.[i]))pending.push(slot);effects[slot]={setup,deps,cleanup:before?.cleanup};},
  };
 }};
 vm.runInNewContext(code,context);
 const render=next=>{if(next)props=next;index=0;return context.module.exports.useProjectAutosave(props);};
 const flush=()=>{const list=pending;pending=[];for(const slot of list){effects[slot].cleanup?.();effects[slot].cleanup=effects[slot].setup();}};
 return {render,flush,replay(){for(const effect of effects)effect?.cleanup?.();for(const effect of effects)if(effect)effect.cleanup=effect.setup();},dispose(){for(const effect of effects)effect?.cleanup?.();}};
}

test('actual hook survives StrictMode effect replay without the abandoned load enabling writes',async()=>{
 const abandoned=deferred();let loads=0;const writes=[];
 const store={load:()=>++loads===1?abandoned.promise:Promise.resolve(null),save:async value=>{writes.push(value.project.script);return prepareProjectCheckpoint(value);}};
 const host=await hookHost({snapshot:snapshot('current'),store,delay:3,restore:async()=>true});
 host.render();host.flush();host.replay();
 abandoned.resolve(await prepareProjectCheckpoint(snapshot('old')));await wait();
 assert.deepEqual(writes,['current']);assert.equal(host.render().status,'saved');host.flush();host.dispose();
});

test('actual hook has no new write for fresh snapshot wrappers or playhead-only renders',async()=>{
 const writes=[];const store={load:async()=>null,save:async value=>{writes.push(value.project.script);return prepareProjectCheckpoint(value);}};
 const props={snapshot:snapshot('current'),store,delay:3,restore:async()=>true};const host=await hookHost(props);
 host.render();host.flush();await wait();
 host.render({...props,snapshot:{...snapshot('current'),project:{script:'current',currentTime:99,timelineZoom:8}}});host.flush();await wait();
 assert.deepEqual(writes,['current']);host.dispose();
});
