import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

// DOM/lifecycle contract host. Actual hooks, shortcut helper and history core run;
// no browser interaction, model imports, production state or timers are used.
function host(hookName='useEditorLifecycle') {
  class Element {
    constructor(tag='BUTTON', attributes={},parent=null){this.tagName=tag;this.attributes=attributes;this.parentElement=parent;this.open=Boolean(attributes.open);this.hidden=Boolean(attributes.hidden);this.isContentEditable=attributes.contenteditable==='true';}
    matches(selector){
      if(selector==='dialog[open]')return this.tagName==='DIALOG'&&this.open;
      if(selector==="[role='dialog']"||selector==='[role="dialog"]')return this.attributes.role==='dialog';
      if(selector==='[role="dialog"][aria-modal="true"]'||selector==="[role='dialog'][aria-modal='true']")return this.attributes.role==='dialog'&&this.attributes['aria-modal']==='true';
      if(selector==='.preview-stage.is-focus-preview')return this.attributes.preview===true;
      if(selector==='[hidden]')return this.hidden;
      if(selector==="[aria-hidden='true']"||selector==='[aria-hidden="true"]')return this.attributes['aria-hidden']==='true';
      if(selector==='[inert]')return Boolean(this.attributes.inert);
      if(selector==="[contenteditable='true']")return this.attributes.contenteditable==='true';
      return selector.toUpperCase()===this.tagName;
    }
    closest(selectors){for(let node=this;node;node=node.parentElement)if(selectors.split(',').some(selector=>node.matches(selector.trim())))return node;return null;}
    getClientRects(){return this.attributes.visible===false?[]:[{}];}
  }
  let modals=[];const listeners=new Set();const slots=[];const effects=[];let pending=[];let index=0;const timers=new Map();let timerId=0;const mutations=[];
  const document={documentElement:{},querySelectorAll(selector){return modals.filter(modal=>selector.split(',').some(part=>modal.matches(part.trim())));},querySelector(selector){return this.querySelectorAll(selector)[0]||null;},defaultView:{getComputedStyle:element=>({display:element.attributes.display||'block',visibility:element.attributes.visibility||'visible'})}};
  const window={addEventListener(type,callback){if(type==='keydown')listeners.add(callback);},removeEventListener(type,callback){if(type==='keydown')listeners.delete(callback);},setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},clearInterval(){}};
  const values={script:'original',captionSegments:[{id:'one',text:'A'},{id:'two',text:'B'},{id:'three',text:'C'}],captionStyle:{},captionPlacement:{},captionStylePresets:[],visualSegments:[],visualOverlaySegments:[],audioSegments:[],stickerSegments:[],userAssets:[],musicSegments:[],timelineMarkers:[],trackVisibility:{},trackLocks:{},selectedTrack:'caption',selectedSegmentId:'one',ratioId:'9:16',activeLanguage:'pt',autoRatioSourceKeyRef:{current:''}};
  const d=new Proxy(values,{get(object,key){if(key in object)return object[key];if(String(key).endsWith('Ref'))return object[key]={current:null};if(key==='notify')return()=>{};if(key==='handleDeleteTrack')return()=>{mutations.push(['delete']);values.captionSegments=values.captionSegments.filter(segment=>segment.id!==values.selectedSegmentId);};if(String(key).startsWith('set'))return value=>{mutations.push([key,value]);object[String(key).slice(3,4).toLowerCase()+String(key).slice(4)]=value;};return undefined;}});
  const react={useRef(initial){const slot=index++;return slots[slot]??={current:initial};},useCallback:fn=>fn,useEffect(setup,deps){const slot=index++;const before=effects[slot];if(!before||!deps||deps.some((value,i)=>value!==before.deps?.[i]))pending.push(slot);effects[slot]={setup,deps,cleanup:before?.cleanup};}};
  const modules={};const context=vm.createContext({document,window,Element,HTMLElement:Element,URL,Blob,console,Map,Set,require(id){
    if(id==='react')return react;
    if(id.includes('editorShortcuts'))return modules.shortcuts;
    if(id.includes('editorHistoryCore'))return modules.core;
    if(id.includes('timelineMarkers'))return modules.markers;
    if(id.includes('config/editor'))return {RATIO_OPTIONS:[]};
    if(id.includes('timeline.js'))return {ensureUniqueVisualSegmentIds:segments=>({changed:false,segments})};
    return {};
  }});
  function load(relative,loader='js'){context.module={exports:{}};vm.runInContext(transformSync(readFileSync(new URL(relative,import.meta.url),'utf8'),{loader,format:'cjs'}).code,context);return context.module.exports;}
  modules.shortcuts=load('../lib/editorShortcuts.js');modules.core=load('../lib/editorHistoryCore.ts','ts');modules.markers=load('../lib/timelineMarkers.js');
  const hook=load(`./${hookName}.js`)[hookName];
  function render(){index=0;const result=hook(d);const queue=pending;pending=[];for(const slot of queue){effects[slot].cleanup?.();effects[slot].cleanup=effects[slot].setup();}return result;}
  function key(key,options={}){const event={key,target:new Element('BUTTON'),prevented:false,preventDefault(){this.prevented=true;},...options};for(const listener of listeners)listener(event);return event;}
  return {Element,d,values,mutations,key,render,shortcuts:modules.shortcuts,setModals(items){modals=items;},flushTimers(){const queue=[...timers.values()];timers.clear();queue.forEach(fn=>fn());}};
}

for(const kind of ['native','aria'])test(`Delete/Backspace cannot delete a caption behind ${kind} modal; Cancel preserves it`,()=>{
 const ui=host();ui.render();ui.mutations.length=0;
 const modal=kind==='native'?new ui.Element('DIALOG',{open:true}):new ui.Element('SECTION',{role:'dialog','aria-modal':'true'});
 ui.setModals([modal]);
 for(const key of ['Backspace','Delete'])assert.equal(ui.key(key,{target:new ui.Element('BUTTON',{},modal)}).prevented,false);
 assert.equal(ui.values.captionSegments.length,3);assert.deepEqual(ui.mutations,[]);
 // Modal's own Cancel closes it; editor handlers must not have consumed that flow.
 ui.setModals([]);assert.equal(ui.key('Escape').prevented,false);assert.equal(ui.values.captionSegments.length,3);
 assert.equal(ui.key('Backspace').prevented,true);assert.equal(ui.values.captionSegments.length,2);
});

for(const kind of ['native','aria'])test(`real undo/redo keyboard handlers do not restore history behind ${kind} modal`,()=>{
 const ui=host('useEditorHistory');ui.render();ui.values.script='edited';ui.render();ui.flushTimers();ui.mutations.length=0;
 ui.setModals([kind==='native'?new ui.Element('DIALOG',{open:true}):new ui.Element('SECTION',{role:'dialog','aria-modal':'true'})]);
 for(const modifier of [{metaKey:true},{ctrlKey:true}])for(const shiftKey of [false,true])assert.equal(ui.key('z',{...modifier,shiftKey}).prevented,false);
 assert.equal(ui.values.script,'edited');assert.deepEqual(ui.mutations,[]);
 ui.setModals([]);assert.equal(ui.key('z',{metaKey:true}).prevented,true);assert.equal(ui.values.script,'original');
 assert.equal(ui.key('z',{ctrlKey:true,shiftKey:true}).prevented,true);assert.equal(ui.values.script,'edited');
});

test('central guard detects a native modal even after focused preview, and ignores closed/hidden/nonmodal dialogs',()=>{
 const ui=host();
 ui.setModals([new ui.Element('DIALOG',{open:true})]);assert.equal(ui.shortcuts.isEditorShortcutBlockedByModal(),true);
 ui.setModals([new ui.Element('SECTION',{role:'dialog','aria-modal':'true',preview:true}),new ui.Element('DIALOG',{open:true})]);assert.equal(ui.shortcuts.isEditorShortcutBlockedByModal(),true);
 for(const modal of [new ui.Element('DIALOG',{role:'dialog','aria-modal':'true'}),new ui.Element('SECTION',{role:'dialog'}),new ui.Element('SECTION',{role:'dialog','aria-modal':'true',hidden:true}),new ui.Element('SECTION',{role:'dialog','aria-modal':'true',visible:false})]){
  ui.setModals([modal]);assert.equal(ui.shortcuts.isEditorShortcutBlockedByModal(),false);
 }
});

test('text controls, nested editable content, Escape and default-prevented keys remain untouched',()=>{
 for(const hookName of ['useEditorLifecycle','useEditorHistory']){
  const ui=host(hookName);ui.render();ui.values.script='edited';ui.render();ui.flushTimers();ui.mutations.length=0;
  for(const target of [new ui.Element('INPUT'),new ui.Element('TEXTAREA'),new ui.Element('SELECT'),new ui.Element('SPAN',{},new ui.Element('DIV',{contenteditable:'true'}))]){
   assert.equal(ui.key('Backspace',{target}).prevented,false);assert.equal(ui.key('z',{target,metaKey:true}).prevented,false);
  }
  assert.equal(ui.key('Escape').prevented,false);
  ui.key('Backspace',{defaultPrevented:true});ui.key('z',{metaKey:true,defaultPrevented:true});
  assert.deepEqual(ui.mutations,[]);
 }
});

test('native isContentEditable remains protected for empty/plaintext-only editing hosts',()=>{
 for(const hookName of ['useEditorLifecycle','useEditorHistory']){
  const ui=host(hookName);ui.render();ui.values.script='edited';ui.render();ui.flushTimers();ui.mutations.length=0;
  const target=new ui.Element('DIV',{contenteditable:'plaintext-only'});target.isContentEditable=true;
  assert.equal(ui.key('Backspace',{target}).prevented,false);assert.equal(ui.key('z',{target,metaKey:true}).prevented,false);
  ui.key('Backspace',{isComposing:true});ui.key('z',{metaKey:true,isComposing:true});assert.deepEqual(ui.mutations,[]);
 }
});
