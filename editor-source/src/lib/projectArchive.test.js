import assert from 'node:assert/strict';
import test from 'node:test';
import {strToU8,zipSync} from 'fflate';
import {createProjectArchive,readProjectArchive} from './projectArchive.js';
function zip(payload,files={}){return new Blob([zipSync({'project.json':strToU8(JSON.stringify(payload)),...files})]);}
const base=()=>({format:'timeline-studio-archive',version:3,project:{script:'Olá',captionSegments:[]},media:{visuals:[],audioSegments:[]}});
for(const kind of ['audio','sourceAudio','music','visuals','audioSegments'])test(`E03 read rejects declared ${kind} binary absent or size-mismatched`,async()=>{
 const payload=base();const entry={id:'media',path:'media/test.wav',size:4,type:'audio/wav'};payload.media[kind]=['visuals','audioSegments'].includes(kind)?[entry]:entry;
 await assert.rejects(readProjectArchive(zip(payload)),/media|mídia|Media/i);
 await assert.rejects(readProjectArchive(zip(payload,{'media/test.wav':new Uint8Array([1])})),/size|tamanho|media|mídia/i);
});
test('read validates project schema, versions, duplicate IDs and references',async()=>{
 for(const modify of [p=>p.project.captionSegments=[null],p=>p.project=null,p=>p.version=999,p=>p.media.visuals=[{id:'x',path:'media/a'},{id:'x',path:'media/a'}],p=>p.project.visualOverlaySegments=[{id:'unknown'}],p=>p.project.trackVisibility={audio:'false'},p=>p.project.captionSegments=[{id:'c',text:'a'},{id:'c',text:'b'}]]){
  const payload=base();modify(payload);await assert.rejects(readProjectArchive(zip(payload,{'media/a':new Uint8Array([1])})));
 }
});
test('valid media-free and v1/v2/v3 archives remain readable',async()=>{
 for(const version of [1,2,3]){const payload=base();payload.version=version;const result=await readProjectArchive(zip(payload));assert.equal(result.payload.project.script,'Olá');assert.equal(result.music,null);}
});
test('real archive roundtrip preserves all declared media and caption/style metadata',async()=>{
 const image=new Blob(['image'],{type:'image/png'}),audio=new Blob(['audio'],{type:'audio/wav'});
 const project={script:'Olá IA',captionSegments:[{id:'c',text:'Olá IA',start:0,end:2,highlightWords:['IA'],fontId:'poppins'}],visualSegments:[{id:'v',type:'image'}],visualOverlaySegments:[{id:'o',type:'image'}],audioSegments:[{id:'a',duration:2}],musicSegments:[{id:'m',duration:2}],sourceAudioVolume:0,musicVolume:0};
 const result=await readProjectArchive(await createProjectArchive({project,visualSegments:[{id:'v',blob:image},{id:'o',blob:image}],audioSegments:[{id:'a',blob:audio}],sourceAudio:{blob:audio},music:{blob:audio}}));
 assert.deepEqual(result.payload.project.captionSegments,project.captionSegments);assert.equal(await result.visualMedia.get('o').blob.text(),'image');assert.equal(await result.sourceAudio.text(),'audio');assert.equal(await result.music.text(),'audio');assert.equal(result.payload.project.musicVolume,0);
});
