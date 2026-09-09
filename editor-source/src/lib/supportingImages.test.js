import assert from 'node:assert/strict';
import test from 'node:test';
import { applySupportingPlan, createSupportingSnapshot, getSupportingGeometry, getSupportingLayoutAtTime, validateSupportingPlan } from './supportingImages.js';
const captions = [{id:'c1',text:'Uma imagem',start:1,end:3},{id:'c2',text:'Outra imagem',start:4,end:6}];
const visuals = [{id:'v1',assetId:'video',src:'blob:video',type:'video',start:0,duration:10,sourceStart:7,playbackRate:1.5,volume:0.7}];
const assets = [{id:'a1',type:'image',name:'Minha foto',src:'blob:one',width:800,height:600,blob:new Blob(['image'])}];
const context = () => ({captionSegments:captions,visualSegments:visuals,visualOverlaySegments:[],assets,timelineDuration:10});
const plan = () => ({version:1,snapshot:createSupportingSnapshot(context()),items:[{captionId:'c1',assetId:'a1',start:1,end:3,topRatio:0.4,videoPosition:{x:0.5,y:0.5}}]});
test('plan rejects stale caption, visual source and overlay snapshots', () => {
 const p=plan();
 assert.throws(()=>validateSupportingPlan(p,{...context(),captionSegments:[{...captions[0],text:'mudou'},captions[1]]}),/supportingStale/);
 assert.throws(()=>validateSupportingPlan(p,{...context(),visualSegments:[{...visuals[0],sourceStart:8}]}),/supportingStale/);
 assert.throws(()=>validateSupportingPlan(p,{...context(),visualOverlaySegments:[{id:'old',start:0,duration:2}]}),/supportingStale/);
});
test('JSON references, numbers, overlaps and timeline bounds are checked without mutation',()=>{
 assert.throws(()=>validateSupportingPlan('{oops',context()),/supportingInvalidJson/);
 for(const patch of [{captionId:'invented'},{assetId:'remote-file'},{start:-1},{end:11},{start:4,end:2},{topRatio:0.95},{start:'1'},{end:Infinity}]) {
  const p=plan();p.items[0]={...p.items[0],...patch};assert.throws(()=>validateSupportingPlan(p,context()),/supporting/);
 }
 const p=plan();p.items.push({...p.items[0],captionId:'c2',start:2,end:4});assert.throws(()=>validateSupportingPlan(p,context()),/supportingOverlap/);
 assert.equal(validateSupportingPlan(plan(),context()).items[0].assetId,'a1');
});
test('one application returns both states and undo originals; sources and audio remain intact',()=>{
 const ctx=context(); const p=plan(); const original=structuredClone(visuals); const result=applySupportingPlan(p,ctx);
 assert.deepEqual(visuals,original);
 assert.equal(result.undo.visualSegments,visuals);assert.equal(result.undo.visualOverlaySegments,ctx.visualOverlaySegments);
 assert.equal(result.visualSegments[0].sourceStart,7);assert.equal(result.visualSegments[0].playbackRate,1.5);assert.equal(result.visualSegments[0].volume,0.7);
 assert.equal(result.visualOverlaySegments[0].blob,assets[0].blob);assert.equal(result.visualOverlaySegments[0].start,1);assert.equal(result.visualOverlaySegments[0].duration,2);
 assert.deepEqual(getSupportingLayoutAtTime(result.visualSegments[0],0),null);
 assert.equal(getSupportingLayoutAtTime(result.visualSegments[0],1).topRatio,0.4);
 assert.deepEqual(getSupportingLayoutAtTime(result.visualSegments[0],3),null);
});
test('universal geometry fits exactly and rejects invalid ratio',()=>{
 const geometry=getSupportingGeometry({topRatio:0.4},1080,1920);
 assert.deepEqual(geometry.image,{x:0,y:0,width:1080,height:768});
 assert.deepEqual(geometry.video,{x:0,y:768,width:1080,height:1152});
 assert.throws(()=>getSupportingGeometry({topRatio:2},1080,1920),/supporting/);
});
test('real sequential visual segments have no start; second clip keeps source and times',()=>{
 const clips=[{id:'first',type:'video',src:'blob:first',duration:4,sourceStart:3},{id:'second',type:'video',src:'blob:second',duration:6,sourceStart:10,playbackRate:.5}];
 const ctx={...context(),visualSegments:clips};const p={...plan(),snapshot:createSupportingSnapshot(ctx),items:[{...plan().items[0],captionId:'c2',start:4,end:6}]};
 const result=applySupportingPlan(p,ctx);assert.equal(result.visualSegments[0].supportingLayout,undefined);
 assert.equal(getSupportingLayoutAtTime(result.visualSegments[1],4).topRatio,.4);
 assert.equal('start' in result.visualSegments[1],false);assert.equal(result.visualSegments[1].sourceStart,10);assert.equal(result.visualSegments[1].playbackRate,.5);
});
test('reapplying replaces supporting overlays only and preserves unrelated overlays',()=>{
 const normal={id:'normal',start:2,duration:1,src:'blob:logo',layer:3};
 const ctx={...context(),visualOverlaySegments:[normal]};const p={...plan(),snapshot:createSupportingSnapshot(ctx)};
 const first=applySupportingPlan(p,ctx);const next={...ctx,visualSegments:first.visualSegments,visualOverlaySegments:first.visualOverlaySegments};
 const second=applySupportingPlan({...p,snapshot:createSupportingSnapshot(next)},next);
 assert.equal(second.visualOverlaySegments.length,2);assert.equal(second.visualOverlaySegments[0],normal);assert.equal(second.visualOverlaySegments[1].layer,4);
});
test('caption text without explicit timing uses the editor caption timing in a draft',async()=>{
 const {createSupportingDraft}=await import('./supportingImages.js');
 const draft=createSupportingDraft({...context(),captionSegments:[{id:'untimed',text:'Legenda nova'}]},assets);
 assert.equal(draft.items[0].start,0);assert.ok(draft.items[0].end>0);assert.ok(draft.items[0].end<=10);
});
test('explicit image import preserves original Blob and revokes failed preview URLs',async(t)=>{
 const {importSupportingImage}=await import('./supportingImages.js');
 const originalImage=globalThis.Image;const revoked=[];
 t.mock.method(URL,'createObjectURL',()=> 'blob:chosen');t.mock.method(URL,'revokeObjectURL',url=>revoked.push(url));
 try {
  globalThis.Image=class{naturalWidth=640;naturalHeight=480;async decode(){}};
  const file=new File(['png'],'own.png',{type:'image/png'});const asset=await importSupportingImage(file);
  assert.equal(asset.blob,file);assert.equal(asset.name,'own.png');assert.equal(asset.width,640);assert.equal(asset.src,'blob:chosen');assert.deepEqual(revoked,[]);
  globalThis.Image=class{async decode(){throw Error('decode error');}};
  await assert.rejects(()=>importSupportingImage(file),/supportingInvalidFile/);assert.deepEqual(revoked,['blob:chosen']);
  await assert.rejects(()=>importSupportingImage(new File(['svg'],'unsafe.svg',{type:'image/svg+xml'})),/supportingInvalidFile/);
 } finally {if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;}
});
test('restored arrangement retains chosen caption, timing, ratio and video position',async()=>{
 const {restoreSupportingDraft}=await import('./supportingImages.js');const ctx=context();
 const p=plan();p.items[0]={...p.items[0],captionId:'c2',start:4.2,end:5.8,topRatio:.55,videoPosition:{x:.2,y:.9}};
 const result=applySupportingPlan(p,ctx);
 const restored=restoreSupportingDraft({...ctx,visualSegments:result.visualSegments,visualOverlaySegments:result.visualOverlaySegments});
 assert.equal(restored.items[0].captionId,'c2');assert.equal(restored.items[0].start,4.2);assert.equal(restored.items[0].end,5.8);assert.equal(restored.items[0].topRatio,.55);assert.deepEqual(restored.items[0].videoPosition,{x:.2,y:.9});
});
