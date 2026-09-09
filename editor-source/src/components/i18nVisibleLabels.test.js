import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { createTranslator } from '../i18n.js';
import { localizeUiMessage } from '../i18nMessageRuntime.js';
import * as depth from '../lib/depthOfField.js';
import * as musicPrompt from '../lib/aiMusicPrompt.js';
import * as parallax from '../lib/photoParallax.js';
const jsx = (type, props) => ({ type, props });
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
function texts(tree) { return nodes(tree).flatMap(n => typeof n.props?.children === 'string' ? [n.props.children] : []).join('\n'); }
function moduleFor(file, extraExports = '') {
 const source = readFileSync(new URL(file, import.meta.url), 'utf8') + extraExports;
 const context = { document: {body:{}}, module: { exports: {} }, require(id) {
  if(id === 'react-dom') return {createPortal: tree=>tree};
  if(id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
  if(id === 'react') return {useMemo: fn=>fn(), useCallback: fn=>fn, useState: initial=>[typeof initial==='function'?initial():initial,()=>{}], useRef: initial=>({current:initial}), useEffect(){}};
  if(id === '../lib/aiMusicPrompt.js') return musicPrompt;
  if(id === '../config/editor.js') return editorConfig;
  if(id === '../lib/depthOfField.js') return depth;
  if(id === '../lib/photoParallax.js') return parallax;
  if(id === '../i18nMessageRuntime.js') return {localizeUiMessage};
  return new Proxy({}, {get:()=>()=>null});
 }};
 vm.runInNewContext(transformSync(source,{loader:'jsx',format:'cjs',jsx:'automatic'}).code,context);
 return context.module.exports;
}
const editorConfig = moduleFor('../config/editor.js');
function translator(language) {
 return createTranslator(language);
}
const runtimeMessage = '已打开 AI 配音';
for(const language of ['pt','en','es']) {
 test(`${language}: visual analysis panels translate stored runtime text at render time`,()=>{
  const t=translator(language); const expected=localizeUiMessage(runtimeMessage,language);
  assert.notEqual(expected,runtimeMessage,'fixture must be a known runtime message');
  const job={stage:'setup',running:true,phase:runtimeMessage,error:runtimeMessage,progress:20};
  const smart=moduleFor('./SmartFramePanel.jsx').SmartFramePanel({t,smartFrame:{segment:{type:'video'},job,settings:{motion:'smooth',padding:0.16}}});
  assert.ok(texts(smart).includes(expected));
  for(const [file,name] of [['./CinematicDepthPanel.jsx','CinematicDepthPanel'],['./PhotoParallaxPanel.jsx','PhotoParallaxPanel']]) {
   const tree=moduleFor(file)[name]({t,segment:{type:'image'},job});
   assert.ok(texts(tree).includes(expected),name);
   assert.ok(!texts(tree).includes(runtimeMessage),name);
  }
  assert.equal(job.phase,runtimeMessage,'rendering must preserve stored job data');
 });
 test(`${language}: favorite voice descriptions translate while names and source records survive`,()=>{
  const tree=moduleFor('./panels.jsx').FavoriteVoicesPanel({t:translator(language),favoriteVoiceIds:['zh_f_qinglan'],voiceProfiles:[{id:'user',name:'我的声音',favorite:true}]});
  const strings=texts(tree);
  assert.ok(strings.includes('Qinglan'));
  assert.ok(!strings.includes('晴岚'));
  assert.equal(editorConfig.VOICES[0].name,'晴岚','catalog identity stays intact');
  assert.ok(strings.includes('我的声音'));
  const metadata=nodes(tree).find(n=>n.type==='span'&&Array.isArray(n.props.children)&&n.props.children.includes(' · '));
  assert.ok(metadata);
  assert.equal(metadata.props.children[0],{pt:'Chinês',en:'Chinese',es:'Chino'}[language]);
  assert.ok(!metadata.props.children.join('').includes('自然中英双语'));
  assert.equal(editorConfig.VOICES[0].language,'中文');
 });
 test(`${language}: local music errors follow active interface language`,()=>{
  const music={job:{running:false,error:runtimeMessage},settings:{}};
  const tree=moduleFor('./panels.jsx').AiMusicGenerator({language,music,embedded:true});
  assert.ok(texts(tree).includes(localizeUiMessage(runtimeMessage,language)));
  assert.equal(music.job.error,runtimeMessage);
 });
}

for(const language of ['pt','en','es']) {
 test(`${language}: plugin failures use runtime translation without rewriting endpoints`,()=>{
  const mod=moduleFor('./GenerationPlugins.jsx','\nexport { LocalConnectionView, JobStatus, getCopy };');
  const copy=mod.getCopy(language);
  const endpoint='http://127.0.0.1:8188/我的服务';
  const connection={state:'error',error:runtimeMessage};
  const tree=mod.LocalConnectionView({copy,connection,endpoint,capabilities:[]});
  const error=nodes(tree).find(n=>n.props?.className==='plugin-error');
  assert.equal(error.props.children.at(-1),localizeUiMessage(runtimeMessage,language));
  assert.equal(nodes(tree).find(n=>n.type==='input').props.value,endpoint);
  const job=mod.JobStatus({copy,plugins:{job:{state:'error',message:runtimeMessage}}});
  assert.ok(texts(job).includes(localizeUiMessage(runtimeMessage,language)));
 });
 test(`${language}: subject analysis status is translated`,()=>{
  const mod=moduleFor('./SubjectEffectsPanel.jsx','\nexport { AnalysisStatus };');
  const tree=mod.AnalysisStatus({t:translator(language),running:true,phase:runtimeMessage});
  assert.ok(texts(tree).includes(localizeUiMessage(runtimeMessage,language)));
 });
}


test('auto-edit review translates errors after language change and preserves caption and clip content',()=>{
 const {AutoEditReviewDialog}=moduleFor('./VoicePanel.jsx','\nexport { AutoEditReviewDialog };');
 const review={open:true,candidates:[],captions:[{id:'caption',visualSegmentId:'clip',text:'用户字幕',start:0,end:1}],segments:[{id:'clip',name:'用户片段',status:'ready'},{id:'failed',name:'第二段',error:runtimeMessage,status:'error'}]};
 const autoEdit={review,job:{running:true,phase:runtimeMessage,progress:15}};
 for(const language of ['pt','es','en']) {
  const tree=AutoEditReviewDialog({t:translator(language),autoEdit});
  const rendered=texts(tree);
  assert.ok(rendered.includes(localizeUiMessage(runtimeMessage,language)));
  assert.ok(rendered.includes('用户字幕'));
  assert.ok(rendered.includes('用户片段'));
  assert.ok(rendered.includes('第二段'));
 }
 assert.equal(review.segments[1].error,runtimeMessage);
 assert.equal(review.captions[0].text,'用户字幕');
});

test('voice metadata translation preserves model identity and unknown metadata',()=>{
 const voice=editorConfig.VOICES[0];
 assert.equal(editorConfig.translateVoiceMetadata(voice.detail,translator('pt')),'Hojo TTS Light 80M · Fala natural em chinês e inglês');
 assert.equal(editorConfig.translateVoiceMetadata(voice.gender,translator('pt')),'Voz feminina natural');
 assert.equal(editorConfig.translateVoiceMetadata('Custom model 中文 name',translator('pt')),'Custom model 中文 name');
 assert.equal(voice.id,'zh_f_qinglan');
 assert.equal(voice.name,'晴岚');
});

test('asset metadata is localized while filenames and license attribution remain unchanged',()=>{
 const {AssetRow}=moduleFor('./panels.jsx','\nexport { AssetRow };');
 for(const language of ['pt','en','es']) {
  const asset={type:'audio',name:'我的录音.wav',meta:runtimeMessage};
  const tree=AssetRow({asset,t:translator(language)});
  assert.ok(texts(tree).includes(localizeUiMessage(runtimeMessage,language)));
  assert.ok(texts(tree).includes(asset.name));
  const credit='作者中文 · CC BY-SA 4.0';
  assert.ok(texts(AssetRow({asset:{...asset,meta:credit},t:translator(language)})).includes(credit));
  assert.equal(asset.meta,runtimeMessage);
 }
});

for(const language of ['pt','en','es'])test(`${language}: built-in voice cards and selected voice hints show romanized display names`,()=>{
 const selectedVoice=editorConfig.VOICES[0];
 const panel=moduleFor('./panels.jsx').VoiceSynthesisPanel({t:translator(language),script:'Fala do usuário 中文',selectedVoice,selectedVoiceId:selectedVoice.id,filteredVoices:editorConfig.VOICES.slice(0,2),favoriteVoiceIds:[],voiceProfiles:[],voiceFilter:'all',speed:1,volume:1,status:'ready',statusText:'',progressPercent:0});
 const all=JSON.stringify(panel);
 assert.ok(all.includes('Qinglan'));assert.ok(all.includes('Ruoxi'));
 assert.ok(!all.includes('晴岚'));assert.ok(!all.includes('若溪'));
 assert.ok(all.includes('Fala do usuário 中文'));
 assert.equal(selectedVoice.name,'晴岚');
});
test('voice history uses catalog display alias and leaves custom names and saved records intact',()=>{
 const item={id:'saved',voiceId:'zh_f_qinglan',voiceName:'晴岚',createdAt:'today',duration:1,script:'texto 中文'};
 const tree=moduleFor('./panels.jsx').HistoryPanel({historyItems:[item],t:translator('pt')});
 assert.ok(texts(tree).includes('Qinglan'));assert.equal(item.voiceName,'晴岚');
 assert.equal(editorConfig.getVoiceDisplayName({id:'custom',name:'我的声音'}),'我的声音');
 assert.equal(editorConfig.getVoiceDisplayName({id:'zh_f_qinglan',name:'Nome personalizado'}),'Nome personalizado');
});
