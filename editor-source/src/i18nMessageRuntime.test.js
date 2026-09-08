import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{localizeUiMessage}from'./i18nMessageRuntime.js';
const baseline=JSON.parse(readFileSync(new URL('../docs/runtime-i18n-baseline.json',import.meta.url),'utf8'));
test('known media and worker errors localize in all three UI languages and preserve dynamic values',()=>{
 for(const language of ['pt','en','es'])for(const {text}of baseline){const sample=text.replaceAll('{0}','VALUE_A').replaceAll('{1}','VALUE_B');const translated=localizeUiMessage(sample,language);assert.doesNotMatch(translated,/\p{Script=Han}/u,`${language}: ${text}`);if(text.includes('{0}'))assert.ok(translated.includes('VALUE_A'));if(text.includes('{1}'))assert.ok(translated.includes('VALUE_B'));}
});
test('unregistered user content is not translated or removed',()=>{const text='Meu vídeo: 你好 mundo';assert.equal(localizeUiMessage(text,'pt'),text);});
