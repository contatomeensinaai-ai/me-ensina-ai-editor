import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import * as timeline from '../lib/timeline.js';
import * as support from '../lib/supportingImages.js';
import { SUPPORTING_IMAGES_COPY } from '../i18nSupportingImages.js';
const code=transformSync(readFileSync(new URL('./SupportingImagesPanel.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsx:'automatic'}).code;
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];
function host(options = {}) {
 const states=[];const cleanups=[];let index=0;let applied=null;const jsx=(type,props)=>({type,props});
 const context={module:{exports:{}},URL:options.URL||URL,AbortController,console,require(id){
  if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};
  if(id==='react')return{useState(initial){const slot=index++;if(!(slot in states))states[slot]=typeof initial==='function'?initial():initial;return[states[slot],v=>states[slot]=typeof v==='function'?v(states[slot]):v];},useRef(initial){const slot=index++;return states[slot]??={current:initial};},useEffect(effect){const slot=index++;if(!(slot in states)){states[slot]=true;const cleanup=effect();if(cleanup)cleanups.push(cleanup);}}};
  if(id.endsWith('supportingImages.js'))return {...support,...options.support};
  if(id.endsWith('timeline.js'))return timeline;
  if(id.endsWith('supportingImagePlanning.js'))return {planSupportingImages:options.plan||(()=>{throw Error('Network must not run in this test');}),supportingPlanningErrorMessage:code=>'Planning: '+code};
  if(id.endsWith('supportingImageGeneration.js'))return {generateSupportingImage:options.generate||(()=>{throw Error('Network must not run in this test');}),supportingImageErrorMessage:code=>'Generation: '+code};
  if(id.endsWith('visualEffects.js'))return {getVisualSourceTime(){return 0;}};
  return{};
 }};
 vm.runInNewContext(code,context);
 const props={t:key=>SUPPORTING_IMAGES_COPY.pt[key],language:'pt',captionSegments:[{id:'c',text:'Legenda original',start:0,end:2}],visualSegments:[{id:'v',type:'video',src:'blob:video',start:0,duration:5,sourceStart:2,volume:.8}],visualOverlaySegments:[{id:'o',assetId:'a',name:'Imagem própria',type:'image',src:'blob:image',blob:new Blob(['x']),width:100,height:100,start:0,duration:2,supportingLayout:{version:1,role:'image',captionId:'c',topRatio:.4}}],timelineDuration:5,onApply(result){applied=result;props.visualSegments=result.visualSegments;props.visualOverlaySegments=result.visualOverlaySegments;}};
 return {props,unmount(){for(const cleanup of cleanups)cleanup();},render(){index=0;return context.module.exports.SupportingImagesPanel(props);},get applied(){return applied;}};
}
test('manual review requires explicit application; editable times preserve original video source',()=>{
 const h=host();let tree=h.render();
 const click=(label)=>nodes(tree).find(n=>n.type==='button'&&n.props.children===label).props.onClick();
 click('Preparar plano editável');tree=h.render();assert.equal(h.applied,null);
 const start=nodes(tree).find(n=>n.type==='input'&&n.props['aria-label']==='Início (s)');assert.ok(start);start.props.onChange({target:{value:'0.5'}});
 tree=h.render();assert.equal(h.applied,null);click('Aplicar plano revisado');
 assert.equal(h.applied.visualOverlaySegments[0].start,.5);assert.equal(h.applied.visualSegments[0].sourceStart,2);assert.equal(h.applied.visualSegments[0].volume,.8);
});
test('stale or malformed plan reports localized error without applying',()=>{
 const h=host();let tree=h.render();nodes(tree).find(n=>n.type==='button'&&n.props.children==='Preparar plano editável').props.onClick();
 h.props.captionSegments=[{...h.props.captionSegments[0],text:'Alterado'}];tree=h.render();
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='Aplicar plano revisado').props.onClick();tree=h.render();
 assert.ok(nodes(tree).some(n=>n.props?.role==='status'&&n.props.children===SUPPORTING_IMAGES_COPY.pt.supportingStale));assert.equal(h.applied,null);
 nodes(tree).find(n=>n.type==='textarea'&&n.props['aria-label']==='Plano JSON para revisar').props.onChange({target:{value:'{broken'}});tree=h.render();
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='Validar e carregar JSON').props.onClick();tree=h.render();
 assert.ok(nodes(tree).some(n=>n.props?.role==='status'&&n.props.children===SUPPORTING_IMAGES_COPY.pt.supportingInvalidJson));assert.equal(h.applied,null);
});
test('all supporting image messages have matching Portuguese English and Spanish keys',()=>{
 const keys=Object.keys(SUPPORTING_IMAGES_COPY.pt).sort();for(const lang of ['en','es'])assert.deepEqual(Object.keys(SUPPORTING_IMAGES_COPY[lang]).sort(),keys);
});
test('generated image requires review; unused URL is revoked on unmount',async()=>{
 const revoked=[];let calls=0;
 const h=host({URL:{revokeObjectURL:url=>revoked.push(url)},generate:async(prompt,{language})=>{calls++;assert.equal(prompt,'Uma paisagem');assert.equal(language,'pt');return new File(['x'],'generated.png',{type:'image/png'});},support:{importSupportingImage:async file=>({id:'generated',name:file.name,blob:file,type:'image',src:'blob:generated',width:100,height:100})}});
 let tree=h.render();nodes(tree).find(n=>n.type==='textarea'&&n.props.maxLength===2000).props.onChange({target:{value:'Uma paisagem'}});tree=h.render();
 await nodes(tree).find(n=>n.type==='button'&&n.props.children==='Gerar imagem com Codex').props.onClick();tree=h.render();
 assert.equal(calls,1);assert.equal(h.applied,null);assert.ok(nodes(tree).some(n=>n.type==='img'&&n.props.src==='blob:generated'));
 h.unmount();assert.deepEqual(revoked,['blob:generated']);
});
test('cancel generation aborts request and does not create or apply an image',async()=>{
 let signal;
 const h=host({generate:(_prompt,options)=>new Promise((_resolve,reject)=>{signal=options.signal;signal.addEventListener('abort',()=>reject(new Error('Canceled')));})});
 let tree=h.render();nodes(tree).find(n=>n.type==='textarea'&&n.props.maxLength===2000).props.onChange({target:{value:'Imagem'}});tree=h.render();
 const pending=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Gerar imagem com Codex').props.onClick();tree=h.render();
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='Cancelar geração').props.onClick();await pending;tree=h.render();
 assert.equal(signal.aborted,true);assert.equal(h.applied,null);assert.ok(nodes(tree).some(n=>n.props?.role==='status'&&n.props.children==='Geração cancelada.'));
});
test('applied image URL stays alive when panel unmounts, preserving timeline and undo',async()=>{
 const revoked=[];
 const h=host({URL:{revokeObjectURL:url=>revoked.push(url)},generate:async()=>new File(['x'],'generated.png',{type:'image/png'}),support:{importSupportingImage:async file=>({id:'generated',name:file.name,blob:file,type:'image',src:'blob:generated',width:100,height:100})}});
 let tree=h.render();nodes(tree).find(n=>n.type==='textarea'&&n.props.maxLength===2000).props.onChange({target:{value:'Imagem'}});tree=h.render();
 await nodes(tree).find(n=>n.type==='button'&&n.props.children==='Gerar imagem com Codex').props.onClick();tree=h.render();
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='Preparar plano editável').props.onClick();tree=h.render();
 nodes(tree).find(n=>n.type==='select'&&n.props.value==='a').props.onChange({target:{value:'generated'}});tree=h.render();
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='Aplicar plano revisado').props.onClick();
 assert.equal(h.applied.visualOverlaySegments[0].src,'blob:generated');h.unmount();assert.deepEqual(revoked,[]);
});
test('after apply, a timing edit can be applied again without becoming stale from its own operation',()=>{
 const h=host();let tree=h.render();nodes(tree).find(n=>n.type==='button'&&n.props.children==='Preparar plano editável').props.onClick();tree=h.render();
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='Aplicar plano revisado').props.onClick();tree=h.render();
 nodes(tree).find(n=>n.type==='input'&&n.props['aria-label']==='Início (s)').props.onChange({target:{value:'0.8'}});tree=h.render();
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='Aplicar plano revisado').props.onClick();tree=h.render();
 assert.equal(h.applied.visualOverlaySegments[0].start,.8);assert.ok(nodes(tree).some(n=>n.props?.role==='status'&&n.props.children===SUPPORTING_IMAGES_COPY.pt.supportingApplied));
});
test('Codex image distribution fills a reviewable draft and never applies automatically',async()=>{
 let calls=0;const h=host({plan:async(ctx,assets,{language})=>{calls++;assert.equal(language,'pt');assert.equal(assets.length,1);return support.createSupportingDraft(ctx,assets);}});
 let tree=h.render();const suggest=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Sugerir distribuição com Codex');assert.ok(suggest,'Automatic distribution button exists');
 await suggest.props.onClick();tree=h.render();assert.equal(calls,1);assert.equal(h.applied,null);assert.ok(nodes(tree).some(n=>n.props?.role==='status'&&n.props.children===SUPPORTING_IMAGES_COPY.pt.supportingReady));
});
test('Codex distribution response is rejected when the current timeline changed during request',async()=>{
 let complete;let result;const h=host({plan:(ctx,assets)=>new Promise(resolve=>{complete=resolve;result=support.createSupportingDraft(ctx,assets);})});
 let tree=h.render();const button=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Sugerir distribuição com Codex');assert.ok(button);
 const pending=button.props.onClick();h.props.captionSegments=[{...h.props.captionSegments[0],text:'Timeline changed'}];h.render();complete(result);await pending;tree=h.render();
 assert.equal(h.applied,null);assert.ok(nodes(tree).some(n=>n.props?.role==='status'&&n.props.children===SUPPORTING_IMAGES_COPY.pt.supportingStale));
});
test('cancel Codex distribution aborts analysis and keeps the reviewed timeline unchanged',async()=>{
 let signal;const h=host({plan:(_ctx,_assets,options)=>new Promise((_resolve,reject)=>{signal=options.signal;signal.addEventListener('abort',()=>reject(new Error('Canceled')));})});
 let tree=h.render();const pending=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Sugerir distribuição com Codex').props.onClick();tree=h.render();
 nodes(tree).find(n=>n.type==='button'&&n.props.children==='Cancelar distribuição').props.onClick();await pending;tree=h.render();
 assert.equal(signal.aborted,true);assert.equal(h.applied,null);assert.ok(nodes(tree).some(n=>n.props?.role==='status'&&n.props.children===SUPPORTING_IMAGES_COPY.pt.supportingPlanningCanceled));
});
