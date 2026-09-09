import assert from 'node:assert/strict';
import test from 'node:test';
import { projectSnapshotFingerprint, prepareProjectCheckpoint, checkpointToArchive, getProjectCheckpointRevision, createProjectCheckpointStore } from './projectPersistence.js';

const media = new Blob(['movie'], {type:'video/mp4'});
const snapshot = (script='Olá') => ({project:{script, captionSegments:[{id:'c',text:script,start:0,end:2}], visualSegments:[{id:'v'}]}, visualSegments:[{id:'v',src:'blob:old',blob:media}],audioSegments:[]});

test('fingerprint ignores view/playhead and ephemeral URLs but includes replaced Blob, content and timing', () => {
  const a=snapshot(); const b={...snapshot(),project:{...snapshot().project,currentTime:42,timelineZoom:7,viewport:{width:900}},visualSegments:[{id:'v',src:'blob:new',blob:media,trackFrames:['temp']}]};
  assert.equal(projectSnapshotFingerprint(a),projectSnapshotFingerprint(b));
  assert.notEqual(projectSnapshotFingerprint(a),projectSnapshotFingerprint(snapshot('Novo')));
  assert.notEqual(projectSnapshotFingerprint(a),projectSnapshotFingerprint({...a, visualSegments:[{id:'v',blob:new Blob(['other'],{type:'video/mp4'})}]}));
});

test('checkpoint structured-clones blobs once and hydrates archive-compatible media maps without ZIP', async () => {
  const input=snapshot(); input.visualSegments.push({id:'overlay',blob:media}); input.audioSegments=[{id:'a',blob:new Blob(['sound'],{type:'audio/wav'})}]; input.sourceAudio={name:'voice',blob:input.audioSegments[0].blob};
  const checkpoint=await prepareProjectCheckpoint(input);
  assert.equal(checkpoint?.version,1);
  assert.equal(checkpoint.blobs.size,2);
  const archive=checkpointToArchive(checkpoint);
  assert.equal(archive.payload.project.script,'Olá');
  assert.equal(archive.visualMedia.get('v').blob,media);
  assert.equal(archive.visualMedia.get('overlay').blob,media);
  assert.equal(archive.audioSegmentMedia.get('a').blob,archive.sourceAudio);
  assert.equal(archive.payload.media.sourceAudio.name,'voice');
});

test('missing media fails before replacing any checkpoint', async () => {
  await assert.rejects(prepareProjectCheckpoint({project:{},visualSegments:[{id:'missing',src:'blob:gone'}]}, {fetchBlob:async()=>{throw new Error('missing media');}}), /missing media/);
});

// A transaction contract double only: completion/abort are driven explicitly.
// This does not claim to test a browser IndexedDB implementation or real quota.
function transactionContract(previous=null,mediaBlobs=new Map()) {
  const writes=[];let tx;
  const db={close(){},transaction(names,mode){
    tx={names,mode,error:null,objectStore(name){return {get(key){const request={};queueMicrotask(()=>{request.result=name==='checkpoints'?previous:mediaBlobs.get(key);request.onsuccess?.();});return request;},put(value,key){writes.push({name,value,key});return {};},delete(key){writes.push({name,key,deleted:true});return {};}};},abort(){queueMicrotask(()=>tx.onabort?.());}};
    return tx;
  }};
  return {db,writes,get tx(){return tx;}};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('save resolves only on atomic transaction completion, with media and checkpoint in same scope',async()=>{
  const contract=transactionContract();const store=createProjectCheckpointStore({openDatabase:async()=>contract.db});
  let settled=false;const saving=store.save(snapshot()).then(value=>{settled=true;return value;});
  await tick();
  assert.equal(settled,false,'must not report saved when put is merely queued');
  assert.deepEqual(contract.tx.names,['checkpoints','media']);assert.equal(contract.tx.mode,'readwrite');
  assert.ok(contract.writes.some(write=>write.name==='media'));
  assert.ok(contract.writes.some(write=>write.name==='checkpoints'));
  contract.tx.oncomplete();
  assert.ok((await saving).savedAt);
});

test('quota/abort rejects the save without a separate destructive cleanup transaction',async()=>{
  const contract=transactionContract();const store=createProjectCheckpointStore({openDatabase:async()=>contract.db});
  const saving=store.save(snapshot());const rejection=assert.rejects(saving,/Quota/);
  await tick();assert.ok(contract.tx,'must write through IndexedDB transaction');
  contract.tx.error=new Error('QuotaExceededError');contract.tx.onabort();await rejection;
  assert.equal(contract.tx.mode,'readwrite');
});

test('recovery rejects a manifest referring to absent media even if its mediaIds list was tampered',async()=>{
 const checkpoint=await prepareProjectCheckpoint(snapshot());
 checkpoint.mediaIds=[];checkpoint.blobs.clear();
 assert.throws(()=>checkpointToArchive(checkpoint),/missing|damaged/);
});

test('metadata-only save reuses media keys instead of writing video again',async()=>{
 const previous=await prepareProjectCheckpoint(snapshot('before'));
 const contract=transactionContract(previous);const store=createProjectCheckpointStore({openDatabase:async()=>contract.db});
 const saving=store.save(snapshot('after'),{expectedRevision:getProjectCheckpointRevision(previous)});await tick();
 assert.equal(contract.writes.filter(write=>write.name==='media').length,0);
 const metadata=contract.writes.find(write=>write.name==='checkpoints').value;
 assert.equal(metadata.snapshot.project.script,'after');assert.equal('blobs' in metadata,false);
 contract.tx.oncomplete();await saving;
});

test('old media cleanup shares the replacement transaction rather than deleting before commit',async()=>{
 const previous=await prepareProjectCheckpoint(snapshot());
 const contract=transactionContract(previous);const store=createProjectCheckpointStore({openDatabase:async()=>contract.db});
 const saving=store.save({project:{script:'new'},visualSegments:[],audioSegments:[]},{expectedRevision:getProjectCheckpointRevision(previous)});await tick();
 assert.ok(contract.writes.some(write=>write.name==='media'&&write.deleted&&write.key===previous.mediaIds[0]));
 assert.equal(contract.tx.names.length,2);contract.tx.oncomplete();await saving;
});

test('load recovers metadata and blobs in a single readonly transaction and awaits completion',async()=>{
 const previous=await prepareProjectCheckpoint(snapshot());const {blobs,...metadata}=previous;
 const contract=transactionContract(metadata,blobs);const store=createProjectCheckpointStore({openDatabase:async()=>contract.db});
 let settled=false;const loading=store.load().then(value=>{settled=true;return value;});await tick();
 assert.equal(contract.tx.mode,'readonly');assert.equal(settled,false);assert.equal(contract.writes.length,0);
 contract.tx.oncomplete();const restored=await loading;
 assert.equal(checkpointToArchive(restored).visualMedia.get('v').blob,media);
 assert.equal(projectSnapshotFingerprint(snapshot()),restored.fingerprint);
});

test('a missing stored binary rejects recovery instead of silently restoring an incomplete project',async()=>{
 const previous=await prepareProjectCheckpoint(snapshot());const {blobs:_blobs,...metadata}=previous;
 const contract=transactionContract(metadata);const store=createProjectCheckpointStore({openDatabase:async()=>contract.db});
 const loading=store.load();const rejection=assert.rejects(loading,/missing/);await tick();contract.tx.oncomplete();await rejection;
});

test('fingerprint is stable across object key order but changes for exact caption and clip timing',()=>{
 const a=snapshot();const b={audioSegments:[],visualSegments:a.visualSegments,project:{visualSegments:[{id:'v'}],captionSegments:a.project.captionSegments,script:'Olá'}};
 assert.equal(projectSnapshotFingerprint(a),projectSnapshotFingerprint(b));
 b.project.captionSegments=[{...a.project.captionSegments[0],end:3}];
 assert.notEqual(projectSnapshotFingerprint(a),projectSnapshotFingerprint(b));
});
