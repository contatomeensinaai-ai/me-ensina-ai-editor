import {createTranslator} from '../i18n.js';
import {keywordAIError,localizeCaptionKeywordError} from '../lib/captionKeywordAICopy.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import * as highlights from '../lib/captionHighlights.js';
const code=transformSync(readFileSync(new URL('./CaptionKeywordsPanel.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsx:'automatic'}).code;
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
function host(suggest){
 const states=[];let index=0,requests=0,applied=0;const jsx=(type,props)=>({type,props});
 const context={module:{exports:{}},AbortController,require(id){
 if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};
 if(id==='react')return{useEffect(){},useRef(){const slot=index++;return states[slot]??=({current:null});},useState(initial){const slot=index++;if(!(slot in states))states[slot]=typeof initial==='function'?initial():initial;return[states[slot],v=>states[slot]=v];}};
 if(id.includes('captionKeywordAI'))return{localizeCaptionKeywordError,requestCaptionKeywordSuggestions:async(...args)=>{requests++;return suggest(...args);}};
 if(id.endsWith('.css'))return{};return highlights;}};
 vm.runInNewContext(code,context);
 const render=()=>{index=0;return nodes(context.module.exports.CaptionKeywordsPanel({t:createTranslator('pt'),language:'pt',selectedCaptionSegment:{id:'one',highlightWords:['existente']},captionSegments:[{id:'one',text:'Use Codex com IA'}],setCaptionSegments(){applied++;}}));};
 return{render,get requests(){return requests;},get applied(){return applied;},button(label){return render().find(n=>n.type==='button'&&n.props.children===label);},get value(){return render().find(n=>n.type==='textarea').props.value;},get status(){return render().find(n=>n.props?.role==='status').props.children;}};
}
test('Codex suggestions are requested explicitly and fill the draft without applying',async()=>{
 const ui=host(async()=>['Codex','IA']);assert.equal(ui.requests,0);
 const button=ui.button('Sugerir palavras com IA');assert.ok(button,'deve oferecer análise pelo Codex');
 await button.props.onClick();assert.equal(ui.requests,1);assert.equal(ui.applied,0);assert.equal(ui.value,'Codex, IA');
});
test('loading disables duplicate requests; cancellation ignores a late result and keeps original draft',async()=>{
 let resolve;const ui=host(()=>new Promise(done=>resolve=done));
 const pending=ui.button('Sugerir palavras com IA').props.onClick();assert.equal(ui.button('Sugerir palavras com IA').props.disabled,true);
 ui.button('Cancelar análise').props.onClick();resolve(['Codex']);await pending;
 assert.equal(ui.value,'existente');assert.equal(ui.applied,0);assert.match(ui.status,/cancelada/);assert.equal(ui.button('Sugerir palavras com IA').props.disabled,false);
});
test('model error is visible and never overwrites saved draft or applies changes',async()=>{
 const ui=host(async()=>{throw keywordAIError('json','pt');});await ui.button('Sugerir palavras com IA').props.onClick();
 assert.equal(ui.value,'existente');assert.equal(ui.applied,0);assert.match(ui.status,/JSON inválido/);
});
