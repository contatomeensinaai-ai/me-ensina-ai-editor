import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectCheckpointStore,prepareProjectCheckpoint,openProjectCheckpointDatabase,checkpointToArchive} from './projectPersistence.js';
import {createProjectAutosaveController} from '../hooks/useProjectAutosave.js';
const snapshot=(script)=>({project:{script},visualSegments:[{id:'v',blob:new Blob([script],{type:'video/mp4'})}],audioSegments:[]});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Executes the real store against a serialized transactional IDB contract. Writes are
// staged and become visible only on complete; abort discards ALL staged mutations.
// This is not a browser IndexedDB implementation or a quota simulation.
function transactionalDatabase(initial=null){
 const state={checkpoints:new Map(),media:new Map()},queue=[];let busy=false;
 if(initial){const{blobs,...metadata}=initial;state.checkpoints.set('latest',structuredClone(metadata));for(const[id,blob]of blobs)state.media.set(id,blob);}
 function pump(){if(busy||!queue.length)return;busy=true;queue.shift()();}
 const openDatabase=async()=>({close(){},transaction(names,mode){
  const pending=[];let stores,active=false,done=false,scheduled=false;
  const tx={error:null,objectStore(name){assert.ok(names.includes(name));return{
   get(key){const request={};pending.push(()=>{request.result=structuredClone(stores[name].get(key));request.onsuccess?.();});schedule();return request;},
   put(value,key){assert.equal(mode,'readwrite');pending.push(()=>stores[name].set(key,structuredClone(value)));schedule();return{};},
   delete(key){assert.equal(mode,'readwrite');pending.push(()=>stores[name].delete(key));schedule();return{};},
  };},abort(){if(done)return;done=true;setImmediate(()=>{tx.onabort?.();busy=false;pump();});}};
  function schedule(){if(!active||scheduled||done)return;scheduled=true;setImmediate(()=>{
   scheduled=false;if(done)return;
   if(pending.length){try{pending.shift()();}catch(error){tx.error=error;tx.abort();return;}schedule();}
   else{done=true;if(mode==='readwrite')for(const name of names)state[name]=stores[name];tx.oncomplete?.();busy=false;pump();}
  });}
  queue.push(()=>{stores=Object.fromEntries(names.map(name=>[name,new Map(state[name])]));active=true;schedule();});pump();return tx;
 }});
 return{openDatabase,state};
}

test('two independent stores cannot overwrite the same expected revision or delete winner media',async()=>{
 const database=transactionalDatabase();const a=createProjectCheckpointStore(database),b=createProjectCheckpointStore(database);
 assert.equal(await a.load(),null);assert.equal(await b.load(),null);
 const results=await Promise.allSettled([a.save(snapshot('winner'),{expectedRevision:null}),b.save(snapshot('loser'),{expectedRevision:null})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'PROJECT_CHECKPOINT_CONFLICT');
 const saved=await a.load();assert.equal(saved.snapshot.project.script,'winner');assert.equal(await checkpointToArchive(saved).visualMedia.get('v').blob.text(),'winner');assert.equal(database.state.media.size,1);
 const changed=await a.save(snapshot('next'),{expectedRevision:saved.revision});
 assert.notEqual(changed.revision,saved.revision);
 await assert.rejects(b.save(snapshot('stale'),{expectedRevision:saved.revision}),{code:'PROJECT_CHECKPOINT_CONFLICT'});
 assert.equal((await a.load()).snapshot.project.script,'next');assert.equal(database.state.media.size,1);
});

test('omitting expected revision is create-only and cannot replace an existing checkpoint',async()=>{
 const database=transactionalDatabase();const store=createProjectCheckpointStore(database);
 await store.save(snapshot('existing'));
 await assert.rejects(store.save(snapshot('implicit overwrite')),{code:'PROJECT_CHECKPOINT_CONFLICT'});
 assert.equal((await store.load()).snapshot.project.script,'existing');
});

test('legacy metadata loads without mutation and migrates only with its reviewed revision',async()=>{
 const legacy=await prepareProjectCheckpoint(snapshot('legacy'));const database=transactionalDatabase(legacy),a=createProjectCheckpointStore(database),b=createProjectCheckpointStore(database);
 const seen=await a.load();assert.equal(typeof seen.revision,'string');assert.equal(database.state.checkpoints.get('latest').revision,undefined);
 const same=await b.load();assert.equal(same.revision,seen.revision);
 const committed=await a.save(snapshot('migrated'),{expectedRevision:seen.revision});assert.notEqual(committed.revision,seen.revision);
 await assert.rejects(b.save(snapshot('stale legacy'),{expectedRevision:same.revision}),{code:'PROJECT_CHECKPOINT_CONFLICT'});
 assert.equal((await a.load()).snapshot.project.script,'migrated');
});

test('database version closes legacy version-one writers instead of silently sharing their protocol',async()=>{
 let version,closed=false;const db={objectStoreNames:{contains:()=>true},close(){closed=true;}};
 const opened=await openProjectCheckpointDatabase({open(_name,v){version=v;const req={result:db};queueMicrotask(()=>req.onsuccess());return req;}});
 assert.equal(version,2);opened.onversionchange();assert.equal(closed,true);
});

test('two controllers preserve winning project; conflict remains error on retry and subsequent edits',async()=>{
 const database=transactionalDatabase();const stores=[createProjectCheckpointStore(database),createProjectCheckpointStore(database)];
 let loads=0,release;const barrier=new Promise(resolve=>release=resolve);const controllers=stores.map(store=>createProjectAutosaveController({delay:0,store:{save:store.save,load:async()=>{const current=await store.load();if(++loads===2)release();await barrier;return current;}},restore:async()=>true}));
 try{
  controllers[0].update(snapshot('A'));controllers[1].update(snapshot('B'));await Promise.all(controllers.map(c=>c.initialize()));
  for(let i=0;i<100&&!controllers.some(c=>c.getState().status==='error');i++)await wait(2);
  const loser=controllers.find(c=>c.getState().status==='error');assert.ok(loser);assert.equal(loser.getState().error.code,'PROJECT_CHECKPOINT_CONFLICT');
  const winner=await stores[0].load();const bytes=await checkpointToArchive(winner).visualMedia.get('v').blob.text();
  loser.update(snapshot('replacement without review'));loser.retry();await wait(20);
  assert.equal(loser.getState().status,'error');const after=await stores[0].load();assert.equal(after.revision,winner.revision);assert.equal(await checkpointToArchive(after).visualMedia.get('v').blob.text(),bytes);
 }finally{controllers.forEach(c=>c.dispose());}
});

test('explicit fresh-start decision cannot replace a checkpoint changed after recovery was offered',async()=>{
 const database=transactionalDatabase(),store=createProjectCheckpointStore(database),other=createProjectCheckpointStore(database);
 const initial=await store.save(snapshot('recovery'));const controller=createProjectAutosaveController({store,delay:0});
 try{controller.update(snapshot('fresh'));await controller.initialize();assert.equal(controller.getState().status,'recovery');
  await other.save(snapshot('newer from other tab'),{expectedRevision:initial.revision});controller.discardRecovery();
  for(let i=0;i<100&&controller.getState().status!=='error';i++)await wait(2);
  assert.equal(controller.getState().error?.code,'PROJECT_CHECKPOINT_CONFLICT');assert.equal((await store.load()).snapshot.project.script,'newer from other tab');
 }finally{controller.dispose();}
});

test('successful recovery carries its reviewed revision into the next edit without rewriting during hydration',async()=>{
 const database=transactionalDatabase(),store=createProjectCheckpointStore(database);
 const original=await store.save(snapshot('restored'));let hydrated;
 const controller=createProjectAutosaveController({store,delay:0,restore:async archive=>{
  hydrated={project:archive.payload.project,visualSegments:[...archive.visualMedia.values()],audioSegments:[]};controller.update(hydrated);return true;
 }});
 try{
  controller.update(snapshot('blank'));await controller.initialize();assert.equal(await controller.restoreRecovery(),true);await wait(5);
  assert.equal((await store.load()).revision,original.revision);
  controller.update({...hydrated,project:{...hydrated.project,script:'edited after restore'}});
  for(let i=0;i<100&&controller.getState().status!=='saved';i++)await wait(2);
  assert.equal(controller.getState().status,'saved');const next=await store.load();assert.equal(next.snapshot.project.script,'edited after restore');assert.notEqual(next.revision,original.revision);
 }finally{controller.dispose();}
});
