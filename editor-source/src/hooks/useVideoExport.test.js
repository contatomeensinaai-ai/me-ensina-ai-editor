import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';

async function fixture(save) {
  const mocks={
    react:'export const useCallback=callback=>callback;',
    'captionFonts.js':'export const ensureCaptionFontLoaded=async()=>{};',
    'exportCancellation.js':'export const isExportAbortError=e=>e.name==="AbortError";export const throwIfExportAborted=s=>s.throwIfAborted();',
    'exportSettings.js':'export const normalizeExportSettings=s=>s;export const getEffectiveExportBitrate=()=>100;export const getExportDimensions=()=>({width:320,height:180});export const getExportContentDuration=()=>1;export const getExportRange=()=>({start:0,end:1,duration:1});export const sanitizeExportFileName=()=>"my-video";',
    'media.js':'export const downloadBlob=()=>{};export const exportBrowserVideo=async()=>globalThis.video;export const transcodeWebmToMp4=async()=>globalThis.video.blob;',
    'offlineVideoExport.js':'export const exportOfflineVideo=async()=>globalThis.video;',
    'subtitles.js':'export const serializeSrt=()=>"1\\n00:00:00,000 --> 00:00:01,000\\nhello";',
    'vision.js':'export const getVisionKey=()=>"key";',
    'embeddedVideoAudioExport.js':'export const prepareEmbeddedVideoAudio=async()=>({blob:null,segments:[]});',
    'generatedMediaMetadata.js':'export const createGeneratedExportMetadata=()=>null;export const embedGeneratedMediaMetadata=async b=>b;',
    'timeline.js':'export const filterTimedSegmentsByLaneVisibility=()=>[];',
    'localArtifactSave.js':'export const saveLocalArtifact=(...args)=>globalThis.save(...args);',
  };
  const output=await build({entryPoints:[new URL('./useVideoExport.js',import.meta.url).pathname],bundle:true,write:false,format:'cjs',plugins:[{name:'export-contract',setup(builder){
    builder.onResolve({filter:/.*/},args=>{if(args.kind==='entry-point')return;const name=args.path.split('/').pop();if(mocks[name])return{path:name,namespace:'mock'};});
    builder.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path]}));
  }}]});
  const context=vm.createContext({module:{exports:{}},Blob,AbortController,performance,console:{error(){},warn(){}},setTimeout:callback=>callback(),save,video:{blob:new Blob(['video']),extension:'webm',label:'WebM'}});
  vm.runInContext(output.outputFiles[0].text,context);
  const statuses=[],receipts=[];
  const d={imageSrc:'fixture',ratio:{id:'16:9',width:16,height:9},exportSettings:{codec:'vp9',pipeline:'deterministic',audio:'none',captions:'none'},exportAbortControllerRef:{},exportStartRef:{},trackVisibility:{},renderedVisualSegments:[],visualOverlaySegments:[],visionRecords:{},selectedFilter:{css:''},previewFrameSize:{width:320,height:180},captionSegments:[],language:'en',t:key=>key,onArtifactSaved:receipt=>receipts.push(receipt),notify(){},setExporting(){},setExportProgress(){},setExportPhase(){},setStatus:status=>statuses.push(status),setStatusText(){}};
  return {run:context.module.exports.useVideoExport(d),d,statuses,receipts};
}

test('does not announce success before disk receipt and returns receipt after confirmed save',async()=>{
  let complete,calls=0;
  const receipt={path:'/safe/video.webm',fileName:'video.webm',bytes:5,sha256:'a'.repeat(64),verified:true};
  const host=await fixture(async()=>{calls++;return new Promise(resolve=>{complete=resolve;});});
  const operation=host.run();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1);
  assert.equal(host.statuses.includes('done'),false);
  complete(receipt);
  const result=await operation;
  assert.equal(result.status,'success');
  assert.deepEqual(Array.from(result.receipts),[receipt]);
  assert.deepEqual(host.receipts,[receipt]);
});

test('disk failure cannot become successful WebM fallback',async()=>{
  const host=await fixture(async()=>{throw Object.assign(new Error('Disk full'),{artifactSaveError:true});});
  host.d.exportSettings.codec='h264';
  const result=await host.run();
  assert.equal(result.status,'failed');
  assert.equal(host.statuses.includes('done'),false);
});

test('partial SRT failure preserves confirmed video receipt and never reports both saved',async()=>{
  const receipt={path:'/safe/video.webm',fileName:'video.webm',bytes:5,sha256:'a'.repeat(64),verified:true};let calls=0;
  const host=await fixture(async()=>{if(++calls===1)return receipt;throw Object.assign(new Error('SRT disk error'),{artifactSaveError:true});});
  host.d.exportSettings.captions='burned-srt';host.d.captionsEnabled=true;host.d.trackVisibility.caption=true;
  const result=await host.run();
  assert.equal(result.status,'failed');
  assert.equal(calls,2);
  assert.deepEqual(Array.from(result.receipts),[receipt]);
  assert.deepEqual(host.receipts,[receipt]);
  assert.equal(host.statuses.includes('done'),false);
});
