import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createTranslator,getStoredLanguage,saveLanguagePreference,LANGUAGE_STORAGE_KEY} from './i18n.js';
test('pt en es never fall back to Chinese even for an unknown key with Chinese legacy fallback',()=>{
 for(const language of ['pt','en','es'])assert.doesNotMatch(createTranslator(language)('untranslatedFeature','尚未翻译'),/\p{Script=Han}/u);
});
test('all static UI translation keys resolve in pt en es without Chinese or raw keys',()=>{
 const entries=[];
 for(const path of readdirSync(new URL('.',import.meta.url),{recursive:true}).filter(path=>/\.(jsx?|tsx?)$/.test(path)&&!path.includes('vendor/')&&!path.includes('.test.')&&!path.startsWith('i18n'))){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  for(const match of source.matchAll(/\bt\(\s*["']([^"']+)["']/g))entries.push([match[1],path]);
 }
 for(const language of ['pt','en','es']){
  const t=createTranslator(language);
  const broken=entries.filter(([key])=>t(key)===key||/\p{Script=Han}/u.test(t(key)));
  assert.deepEqual(broken,[],`${language}: missing UI copy`);
 }
});
test('language choice survives reload, settings changes persist and inaccessible storage is safe',()=>{
 const previous=globalThis.window;const values=new Map();globalThis.window={localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}};
 try{assert.equal(getStoredLanguage(),'');for(const lang of ['pt','en','es']){saveLanguagePreference(lang);assert.equal(values.get(LANGUAGE_STORAGE_KEY),lang);assert.equal(getStoredLanguage(),lang);}values.set(LANGUAGE_STORAGE_KEY,'unknown');assert.equal(getStoredLanguage(),'');globalThis.window.localStorage.getItem=()=>{throw Error('denied');};assert.equal(getStoredLanguage(),'');}finally{globalThis.window=previous;}
});
