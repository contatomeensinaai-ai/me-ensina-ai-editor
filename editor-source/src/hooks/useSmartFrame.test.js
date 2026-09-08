import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

function mount(props, analyze=async()=>({})) {
 const states=[];let index=0;
 const context={module:{exports:{}},AbortController,performance,require(id){
  if(id==='react')return {useEffect(){},useCallback:fn=>fn,useMemo:fn=>fn(),useRef(){return states[index++]??={current:null};},useState(initial){const i=index++;if(!(i in states))states[i]=initial;return [states[i],v=>{states[i]=v;}];}};
  if(id.includes('editor'))return {RATIO_OPTIONS:[{id:'16:9',width:16,height:9}]};
  if(id.includes('smartFrameAnalysis'))return {analyzeSmartFrameClip:analyze};
  return {normalizeSmartFrame:v=>v,buildSmartFrameRecord:v=>v};
 }};
 vm.runInNewContext(transformSync(readFileSync(new URL('./useSmartFrame.js',import.meta.url),'utf8'),{format:'cjs'}).code,context);
 return ()=>{index=0;return context.module.exports.useSmartFrame(props);};
}
test('Smart Frame notices and stored job phase use current translator',async()=>{
 let language='en';const notices=[];
 const props={t:k=>`${language}:${k}`,notify:m=>notices.push(m),setRatioId(){},setVisualSegments(){}};
 const render=mount(props);
 await render().analyze();
 assert.equal(notices[0],'en:smartFrameSelectClip');
 props.selectedSegment={id:'clip',type:'video'};
 await render().analyze();
 language='es';
 assert.equal(render().job.phase,'es:smartFramePreviewReady');
 assert.equal(notices[1],'en:smartFramePreviewNotice');
});
test('Smart Frame worker phases are localized and preserve frame counts',async()=>{
 let finish;const props={t:k=>`pt:${k}`,selectedSegment:{id:'clip',type:'video'},setRatioId(){}};
 const render=mount(props,({onProgress})=>{onProgress({stage:'analysis',progress:50,phase:'光流跟踪 5/10'});return new Promise(r=>{finish=r;});});
 const pending=render().analyze();
 assert.equal(render().job.phase,'pt:smartFrameTracking 5/10');
 finish({});await pending;
});
