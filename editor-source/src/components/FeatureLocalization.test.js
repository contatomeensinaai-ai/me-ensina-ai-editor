import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import {FEATURE_COPY} from '../i18nFeatureCopy.js';
import * as highlights from '../lib/captionHighlights.js';

function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node,...nodes(node.props?.children)]; }
function mount(file, props, request = async()=>['Codex']) {
  const states=[]; let index=0;
  const jsx=(type,props)=>({type,props});
  const context={module:{exports:{}},AbortController,require(id){
    if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(id==='react')return {useEffect(){},useId:()=> 'id',useRef(){return states[index++]??={current:null};},useState(initial){const slot=index++; if(!(slot in states))states[slot]=typeof initial==='function'?initial():initial;return [states[slot],v=>{states[slot]=v;}];}};
    if(id.includes('captionKeywordAI'))return {requestCaptionKeywordSuggestions:request,localizeCaptionKeywordError:(_error,language)=>`${language}:error`};
    if(id.includes('captionHighlights'))return highlights;
    if(id.includes('config/editor'))return {RATIO_OPTIONS:[{id:'16:9',label:'16:9',width:16,height:9}]};
    if(id==='@phosphor-icons/react')return new Proxy({},{get:(_,name)=>name});
    return {};
  }};
  vm.runInNewContext(transformSync(readFileSync(new URL(file,import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsx:'automatic'}).code,context);
  return ()=>{index=0;return Object.values(context.module.exports)[0](props);};
}
test('keyword labels and completed status follow translator after language change without replacing draft',async()=>{
  let language='en';
  const props={language,t:key=>`${language}:${key}`,selectedCaptionSegment:{id:'one',highlightWords:['Minha IA']},captionSegments:[{id:'one',text:'Codex'}],setCaptionSegments(){throw Error('must not apply');}};
  const render=mount('./CaptionKeywordsPanel.jsx',props);
  let tree=render();
  assert.equal(tree.props['aria-label'],'en:captionKeywordsTitle');
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,'Minha IA');
  await nodes(tree).find(n=>n.type==='button'&&n.props.children==='en:captionKeywordsSuggest').props.onClick();
  language='es';props.language=language;tree=render();
  assert.equal(nodes(tree).find(n=>n.props.role==='status').props.children,'es:captionKeywordsReady');
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,'Codex');
});
test('style dialog re-translates controls but preserves edited user name',()=>{
  let language='pt';const props={t:key=>`${language}:${key}`,onSave(){},onCancel(){}};
  const render=mount('./CaptionStyleDialog.jsx',props);let tree=render();
  nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'Estilo da minha live'}});
  language='es';tree=render();
  assert.equal(nodes(tree).find(n=>n.type==='input').props.value,'Estilo da minha live');
  assert.equal(nodes(tree).find(n=>n.props.type==='submit').props.children,'es:captionSaveAsStyle');
});

for (const language of ['pt','en','es']) {
 test(`Smart Frame and keyword controls render complete ${language} copy`,()=>{
  const copy=FEATURE_COPY[language];
  assert.deepEqual(Object.keys(copy).sort(),Object.keys(FEATURE_COPY.en).sort());
  const t=key=>{
   if(key==='cancel')return {pt:'Cancelar',en:'Cancel',es:'Cancelar'}[language];
   if(key==='apply')return {pt:'Aplicar',en:'Apply',es:'Aplicar'}[language];
   assert.ok(copy[key],`Missing ${language}:${key}`);return copy[key];
  };
  for(const state of ['empty','ready','running']) {
   const smartFrame=state==='empty'?{}:{segment:{type:'video'},targetRatioId:'16:9',settings:{motion:'smooth',padding:0.16},job:{stage:'setup',running:state==='running'},draft:{presentation:'safe-contain',stats:{runtimeBackend:'webgpu',analysisMs:2500}},applied:{},dirty:false};
   const tree=mount('./SmartFramePanel.jsx',{t,smartFrame})();
   assert.doesNotMatch(JSON.stringify(tree),/[\u3400-\u9fff]/);
   assert.ok(nodes(tree).some(n=>n.props.children===copy.smartFrameCurrentClip));
  }
  const tree=mount('./CaptionKeywordsPanel.jsx',{t,language,captionSegments:[],selectedCaptionSegment:null})();
  assert.equal(tree.props['aria-label'],copy.captionKeywordsTitle);
  assert.equal(nodes(tree).find(n=>n.type==='textarea').props.placeholder,copy.captionKeywordsPlaceholder);
 });
}

test('a displayed keyword error re-translates when language changes and keeps the manual selection',async()=>{
 const props={language:'en',t:k=>k,selectedCaptionSegment:{id:'one',highlightWords:['Meu texto']},captionSegments:[{text:'Meu texto'}]};
 const render=mount('./CaptionKeywordsPanel.jsx',props,async()=>{throw new Error('old language');});
 await nodes(render()).find(n=>n.type==='button'&&n.props.children==='captionKeywordsSuggest').props.onClick();
 props.language='es';const tree=render();
 assert.equal(nodes(tree).find(n=>n.props.role==='status').props.children,'es:error');
 assert.equal(nodes(tree).find(n=>n.type==='textarea').props.value,'Meu texto');
});
