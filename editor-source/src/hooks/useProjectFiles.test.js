import * as archiveModule from '../lib/projectArchive.js';
import * as restorationModule from '../lib/restorationMedia.js';
import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';import{transformSync}from'esbuild';
const code=transformSync(readFileSync(new URL('./useProjectFiles.js',import.meta.url),'utf8'),{format:'cjs'}).code;
function host({archive,urlApi=URL,decode=async()=>({duration:2,peaks:[]}),save=async()=>({path:'/verified/project.timeline',bytes:3,sha256:'abc'})}={}){
 const mutations=[];const notices=[];const jsxDeps={visualSegments:[],visualOverlaySegments:[],audioSegments:[],captionSegments:[],captionStyle:{fontId:'poppins'},captionStylePresets:[{id:'mine',name:'Meu estilo'}],captionStylePresetId:'mine',projectFileInputRef:{current:{}},imageUrlRefs:{current:new Set()},t:key=>key,language:'pt',notify:m=>notices.push(m)};
 const deps=new Proxy(jsxDeps,{get(target,key){return key in target?target[key]:(...args)=>{if(String(key).startsWith('set')||String(key).startsWith('replace')||String(key).startsWith('clear'))mutations.push([key,...args]);};}});
 let saved=false;const context={module:{exports:{}},crypto,Blob,URL:urlApi,Map,console,window:{},require(id){if(id.includes('restorationMedia'))return restorationModule;if(id==='react')return{useRef:value=>({current:value}),useCallback:fn=>fn,useState:value=>[value,()=>{}]};if(id.includes('config/editor'))return{DEFAULT_SCRIPT:'',DEFAULT_TIMELINE_DURATION_SECONDS:60,normalizeVoiceId:v=>v,VOICES:[{id:'voice'}],RATIO_OPTIONS:[{id:'9:16'}]};if(id.includes('localArtifactSave'))return{saveLocalArtifact:async(...args)=>{const result=await save(...args);saved=true;return result;}};if(id.includes('media.js'))return{decodeWaveform:decode,downloadBlob(){}};if(id.includes('projectArchive'))return{...archiveModule,readProjectArchive:async()=>archive,createProjectArchive:async()=>new Blob(['zip']),resolveProjectVisualMedia:(media,segment)=>media.get(segment.id)};return new Proxy({},{get:(_target,key)=>key==='createCaptionSegments'?()=>[]:key==='normalizeTimelineMarkers'?v=>v||[]:key.startsWith('normalize')?v=>v:key.startsWith('get')?()=>0:()=>null});}};
 vm.runInNewContext(code,context);return{api:context.module.exports.useProjectFiles(deps),mutations,notices,deps:jsxDeps,get saved(){return saved;}};
}
test('media decode failure leaves the current project untouched',async()=>{
 const ui=host({archive:{payload:{project:{captionSegments:[],audioSegments:[{id:'audio'}]}},visualMedia:new Map(),audioSegmentMedia:new Map([['audio',{blob:new Blob(['broken'])}]]),audio:null},decode:async()=>{throw new Error('broken audio');}});
 await ui.api.handleImportProject(new Blob(['archive']));assert.deepEqual(ui.mutations,[],JSON.stringify(ui.notices));
});
test('export awaits verified local saving instead of assuming anchor download succeeded',async()=>{const ui=host();await ui.api.handleExportProject();assert.equal(ui.saved,true);});
test('actual project hook snapshots and hydrates reversible restoration pairs and tracks all fresh URLs',async()=>{
 const original=new Blob(['original'],{type:'image/png'}),processed=new Blob(['processed'],{type:'image/png'});
 const visual={id:'v',type:'image',duration:2,src:'blob:expired-active',blob:processed,enhancement:{mode:'nanovsr-644k',enabled:true,original:{src:'blob:expired-original',blob:original,width:10,height:10},processed:{src:'blob:expired-result',blob:processed,width:20,height:20}}};
 const ui=host();ui.deps.visualSegments=[visual];
 const input=ui.api.getProjectArchiveInput();assert.equal(input.project.visualSegments[0].enhancement.original.src,undefined);
 const archive=await archiveModule.readProjectArchive(await archiveModule.createProjectArchive(input));await ui.api.restoreProjectArchive(archive);
 const restored=ui.mutations.find(([key])=>key==='setVisualSegments')[1][0];
 assert.equal(await restored.blob.text(),'processed');assert.equal(await restored.enhancement.original.blob.text(),'original');assert.equal(await restored.enhancement.processed.blob.text(),'processed');
 assert.notEqual(restored.enhancement.original.src,visual.enhancement.original.src);assert.ok(ui.deps.imageUrlRefs.current.has(restored.enhancement.original.src));assert.ok(ui.deps.imageUrlRefs.current.has(restored.enhancement.processed.src));
 assert.equal(ui.deps.imageUrlRefs.current.size,3);
 for(const url of ui.deps.imageUrlRefs.current)URL.revokeObjectURL(url);
});
test('restoration publishes style, highlights, supporting image metadata and muted volumes together',async()=>{
 const blob=new Blob(['media']);const image={id:'image',type:'image',supportingLayout:{version:1,role:'image',topRatio:.4}};const video={id:'video',type:'video',duration:6,supportingLayout:{version:1,windows:[{start:1,end:3,topRatio:.4}]}};const captions=[{id:'caption',text:'Olá IA',start:1,end:3,fontId:'poppins',highlightWords:['IA'],highlightColor:'#35f0dd'}];const style={fontId:'poppins',textColor:'#ecfffd'};
 const archive={payload:{project:{captionSegments:captions,captionStyle:style,captionStylePresetId:'mine',captionStylePresets:[{id:'mine',name:'Meu estilo',style}],visualSegments:[video],visualOverlaySegments:[image],audioSegments:[{id:'audio',start:0,duration:6}],volume:0,sourceAudioVolume:0,musicVolume:0,musicSegments:[{id:'music',start:1,duration:4}]}},visualMedia:new Map([['video',{blob}],['image',{blob}]]),audioSegmentMedia:new Map([['audio',{blob}]]),sourceAudio:blob,music:blob};
 const ui=host({archive});await ui.api.restoreProjectArchive(archive);const value=key=>ui.mutations.find(m=>m[0]===key)?.[1];
 assert.equal(value('setVolume'),0);assert.equal(value('setSourceAudioVolume'),0);assert.equal(value('setMusicVolume'),0);assert.deepEqual(value('setCaptionStyle'),style);assert.deepEqual(value('setCaptionSegments'),captions);assert.equal(value('setCaptionStylePresets')[0].id,'mine');assert.equal(value('setVisualSegments')[0].blob,blob);assert.equal(value('setVisualOverlaySegments')[0].blob,blob);assert.equal(value('setVisualOverlaySegments')[0].supportingLayout.topRatio,.4);assert.equal(value('setMusicSegments')[0].duration,4);
});
test('New project requests an in-editor confirmation even when window.confirm is unavailable',()=>{
 const ui=host();assert.doesNotThrow(()=>ui.api.handleNewProject());
 assert.deepEqual(ui.mutations.map(([key])=>key),['setShowFileMenu','setShowNewProjectConfirmation']);
 assert.equal(ui.mutations.at(-1)[1],true);assert.deepEqual(ui.notices,[]);
});
test('confirmed New project clears all tracks and finally clears captions after audio unlinking',()=>{
 const ui=host();assert.equal(typeof ui.api.confirmNewProject,'function');ui.api.confirmNewProject();
 const called=ui.mutations.map(([key])=>key);for(const key of ['clearImageTrack','clearAudioTrack','clearSourceAudioTrack','clearMusicTrack','clearAllVisionState'])assert.ok(called.includes(key),key);
 for(const key of ['setCaptionSegments','setVisualOverlaySegments','setStickerSegments','setTimelineMarkers'])assert.equal(ui.mutations.find(([name])=>name===key)?.[1].length,0,key);
 assert.equal(ui.mutations.find(([key])=>key==='setScript')[1],'');
 assert.ok(called.indexOf('setCaptionSegments')>called.indexOf('clearAudioTrack'));
 assert.equal(ui.mutations.find(([key])=>key==='setCurrentTime')[1],0);
 assert.equal(ui.mutations.at(-1)[0],'setShowNewProjectConfirmation');assert.equal(ui.mutations.at(-1)[1],false);
 assert.deepEqual(ui.notices,['projectNewCreated']);
});

const emptyArchive=project=>({payload:{project},visualMedia:new Map(),audioSegmentMedia:new Map()});
test('E02 invalid project structures reject before any setter or reference mutation',async()=>{
 for(const project of [{script:'new',captionSegments:[null]},{script:'new',captionSegments:[{id:'c',text:7}]},{captionStyle:[]},{captionPlacement:{x:'broken',y:50}},{musicSegments:'bad'},{visualSegments:[{id:'v',keyframes:[null]}]},{trackLocks:{caption:'false'}},{captionSegments:[{id:'c',text:'x',start:4,end:2}]}]){
  const archive=emptyArchive(project);const ui=host({archive});
  await assert.rejects(ui.api.restoreProjectArchive(archive));assert.deepEqual(ui.mutations,[],JSON.stringify(project));assert.equal(ui.deps.imageUrlRefs.current.size,0);
 }
});
test('E03 all declared primary and segment media must exist before editor publication',async()=>{
 for(const key of ['audio','sourceAudio','music']){
  const archive=emptyArchive({script:'new'});archive.payload.media={[key]:{path:`media/${key}.wav`,size:4}};archive[key]=null;
  const ui=host({archive});await assert.rejects(ui.api.restoreProjectArchive(archive));assert.deepEqual(ui.mutations,[]);
 }
 for(const key of ['visualSegments','visualOverlaySegments','audioSegments']){
  const archive=emptyArchive({[key]:[{id:'missing'}]});const ui=host({archive});await assert.rejects(ui.api.restoreProjectArchive(archive));assert.deepEqual(ui.mutations,[]);
 }
});
test('URL allocation failure releases new URLs and preserves original project and refs',async()=>{
 let count=0;const revoked=[];const blob=new Blob(['image']);
 const urlApi={createObjectURL(){if(++count===2)throw new Error('URL allocation failed');return 'blob:new-one';},revokeObjectURL:url=>revoked.push(url)};
 const archive={...emptyArchive({script:'new',visualSegments:[{id:'v'}],visualOverlaySegments:[{id:'o'}]}),visualMedia:new Map([['v',{blob}],['o',{blob:new Blob(['other'])}]])};
 const ui=host({archive,urlApi});ui.deps.imageUrlRefs.current.add('blob:original');
 await assert.rejects(ui.api.restoreProjectArchive(archive),/allocation/);assert.deepEqual(ui.mutations,[]);assert.deepEqual(revoked,['blob:new-one']);assert.deepEqual([...ui.deps.imageUrlRefs.current],['blob:original']);
});
test('prepared restore adopts source/music URLs and registers overlays without allocation during publish',async()=>{
 let allocated=0;const blob=new Blob(['media']);const urlApi={createObjectURL:()=>`blob:prepared-${++allocated}`,revokeObjectURL(){}};
 const archive={...emptyArchive({visualOverlaySegments:[{id:'overlay'}]}),visualMedia:new Map([['overlay',{blob}]]),sourceAudio:blob,music:blob};
 const ui=host({archive,urlApi});await ui.api.restoreProjectArchive(archive);
 assert.ok(ui.mutations.find(([key])=>key==='replaceSourceAudio').at(-1).preparedUrl);
 assert.ok(ui.mutations.find(([key])=>key==='replaceMusic').at(-1).preparedUrl);
 assert.ok(ui.deps.imageUrlRefs.current.has(ui.mutations.find(([key])=>key==='setVisualOverlaySegments')[1][0].src));
});

test('older pending restoration cannot publish after a newer project', async () => {
 let resolve; const blob = new Blob(['pending']);
 const ui = host({decode: () => new Promise(done => { resolve = done; })});
 const old = ui.api.restoreProjectArchive({...emptyArchive({script:'old'}),sourceAudio:blob});
 await ui.api.restoreProjectArchive(emptyArchive({script:'new'}));
 const committed = ui.mutations.length;
 resolve({duration:2,peaks:[]}); assert.equal(await old,false);
 assert.equal(ui.mutations.length,committed);
 assert.equal(ui.mutations.find(([key])=>key==='setScript')[1],'new');
});
test('confirmed New invalidates pending restoration', async () => {
 let resolve; const ui = host({decode: () => new Promise(done => { resolve = done; })});
 const old = ui.api.restoreProjectArchive({...emptyArchive({script:'old'}),sourceAudio:new Blob(['pending'])});
 ui.api.confirmNewProject(); const committed = ui.mutations.length;
 resolve({duration:2,peaks:[]}); assert.equal(await old,false); assert.equal(ui.mutations.length,committed);
});
test('legacy main audio replaces previous audio segments instead of appending', async () => {
 const ui = host(); ui.deps.audioSegments = [{id:'old',url:'blob:old'}];
 await ui.api.restoreProjectArchive({...emptyArchive({audioDuration:2}),audio:new Blob(['audio'])});
 const segments = ui.mutations.find(([key])=>key==='setAudioSegments')[1];
 assert.equal(segments.length,1); assert.notEqual(segments[0].id,'old'); assert.equal(segments[0].start,0);
 assert.equal(ui.mutations.some(([key])=>key==='replaceAudio'),false);
});

test('invalid import uses the localized project error', async () => {
 const ui = host({archive:emptyArchive({captionSegments:[null]})});
 await ui.api.handleImportProject(new Blob(['archive']));
 assert.deepEqual(ui.mutations,[]); assert.deepEqual(ui.notices,['projectInvalid']);
});
