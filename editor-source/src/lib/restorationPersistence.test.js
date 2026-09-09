import test from 'node:test';import assert from 'node:assert/strict';
import {createProjectArchive,readProjectArchive,validateProjectArchive} from './projectArchive.js';
import {prepareProjectCheckpoint,checkpointToArchive,projectSnapshotFingerprint} from './projectPersistence.js';
import {hydrateVisualRestorations,serializeVisualSegment} from './restorationMedia.js';
import {unzipSync} from 'fflate';
const original=new Blob(['original pixels'],{type:'image/png'}),processed=new Blob(['restored pixels'],{type:'image/png'});
function fixture(key='enhancement',enabled=true){const result={mode:key==='repair'?'migan-256-webgpu':'nanovsr-644k',enabled,original:{blob:original,src:'blob:old-original',width:20,height:20,sourceStart:1,sourceDuration:3},processed:{blob:processed,src:'blob:old-processed',width:40,height:40,sourceStart:0,sourceDuration:2}};const visual={id:'visual',type:'image',duration:2,...(enabled?result.processed:result.original),[key]:result};return{project:{visualSegments:[visual],visualOverlaySegments:[],captionSegments:[],captionStyle:{fontId:'poppins'}},visualSegments:[visual],audioSegments:[]};}
for(const key of ['enhancement','repair'])for(const enabled of [true,false])test(`${key}, enabled=${enabled}: archive and checkpoint retain both media variants without stale URLs`,async()=>{
 const input=fixture(key,enabled);
 for(const archive of [await readProjectArchive(await createProjectArchive(input)),checkpointToArchive(await prepareProjectCheckpoint(input))]){
  validateProjectArchive(archive);const visual=archive.payload.project.visualSegments[0];
  assert.equal(visual[key].enabled,enabled);
  for(const [role,blob]of [['original',original],['processed',processed]]){
   const metadata=visual[key][role];assert.equal(typeof metadata.archiveMediaId,'string');
   assert.deepEqual(await archive.visualMedia.get(metadata.archiveMediaId).blob.text(),await blob.text());
   assert.equal(metadata.src,undefined);assert.equal(metadata.blob,undefined);
  }
  assert.equal(await archive.visualMedia.get('visual').blob.text(),await(enabled?processed:original).text());
 }
});
test('changing inactive restoration bytes changes autosave fingerprint',()=>{
 const input=fixture();const changed=fixture();changed.visualSegments[0].enhancement.original.blob=new Blob(['different original']);
 assert.notEqual(projectSnapshotFingerprint(input),projectSnapshotFingerprint(changed));
});
test('archive stores active/processed Blob only once and never turns alternatives into clips',async()=>{
 const blob=await createProjectArchive(fixture());const files=unzipSync(new Uint8Array(await blob.arrayBuffer()));
 assert.equal(Object.keys(files).filter(p=>p.startsWith('media/visuals/')).length,2);
 const archive=await readProjectArchive(blob);assert.equal(archive.payload.project.visualSegments.length,1);assert.equal(archive.visualMedia.size,3);
});
test('missing inactive media rejects export and recovery instead of recording a broken toggle',async()=>{
 const input=fixture();delete input.visualSegments[0].enhancement.original.blob;delete input.visualSegments[0].enhancement.original.src;
 await assert.rejects(createProjectArchive(input),/restoration media/);
 await assert.rejects(prepareProjectCheckpoint(input),/restoration media/);
 const archive=await readProjectArchive(await createProjectArchive(fixture()));const id=archive.payload.project.visualSegments[0].enhancement.original.archiveMediaId;
 archive.visualMedia.delete(id);archive.payload.media.visuals=archive.payload.media.visuals.filter(item=>item.id!==id);
 assert.throws(()=>validateProjectArchive(archive),/Missing project media/);
});
test('legacy missing pairs keep active visual and drop expired reversible controls; frame trials stay transient',()=>{
 const legacy=fixture().visualSegments[0];const hydrated=hydrateVisualRestorations(legacy,new Map(),()=>{throw Error('no alternate allocation');});
 assert.equal(hydrated.blob,processed);assert.equal(hydrated.enhancement,undefined);
 assert.equal(serializeVisualSegment({...legacy,enhancement:{mode:'remaster-drunet',previewUrl:'blob:frame'}}).enhancement,undefined);
});
