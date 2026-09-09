import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{localizeUiMessage}from'./i18nMessageRuntime.js';
const baseline=JSON.parse(readFileSync(new URL('../docs/runtime-i18n-baseline.json',import.meta.url),'utf8'));
test('known media and worker errors localize in all three UI languages and preserve dynamic values',()=>{
 for(const language of ['pt','en','es'])for(const {text}of baseline){const sample=text.replaceAll('{0}','VALUE_A').replaceAll('{1}','VALUE_B');const translated=localizeUiMessage(sample,language);assert.doesNotMatch(translated,/\p{Script=Han}/u,`${language}: ${text}`);if(text.includes('{0}'))assert.ok(translated.includes('VALUE_A'));if(text.includes('{1}'))assert.ok(translated.includes('VALUE_B'));}
});
test('unregistered user content is not translated or removed',()=>{const text='Meu vídeo: 你好 mundo';assert.equal(localizeUiMessage(text,'pt'),text);});
const currentCorpus=JSON.parse(readFileSync(new URL('../docs/runtime-i18n-current-corpus.json',import.meta.url),'utf8'));
test('all audited UI notifications, errors and progress literals localize in pt/en/es',()=>{
 const missing=[];
 for(const language of ['pt','en','es'])for(const {text,sites} of currentCorpus){
  const sample=text.replace(/\{(?:\d+|count)\}/g,'VALUE');
  const result=localizeUiMessage(sample,language);
  if(/\p{Script=Han}/u.test(result))missing.push(`${language}: ${text} (${sites[0].path}:${sites[0].line})`);
 }
 assert.deepEqual(missing,[]);
});
test('nested system progress is translated but media names remain literal',()=>{
 assert.equal(localizeUiMessage('帧 3/8 · 人物稳定','en'),'Frame 3/8 · Person stable');
 assert.equal(localizeUiMessage('人物稳定素材已插入到图片轨','en'),'人物稳定 added to the visual track (inserted).');
 assert.equal(localizeUiMessage('字幕轨已锁定，无法编辑.mov 已恢复','en'),'字幕轨已锁定，无法编辑.mov has been restored');
});
test('composed UI failures translate their cause without dropping diagnostics or filenames',async()=>{
 const {formatUiFailure}=await import('./i18nMessageRuntime.js');
 const {createTranslator}=await import('./i18n.js');
 for(const language of ['pt','en','es']){
  const t=createTranslator(language);
  const output=formatUiFailure(t,'projectSaveFailed',new Error('读取目标素材失败（HTTP 403）'));
  assert.doesNotMatch(output,/\p{Script=Han}/u);assert.match(output,/403/);
  assert.ok(formatUiFailure(t,'projectSaveFailed',new Error('无法读取视频素材：我的视频.mov')).includes('我的视频.mov'));
 }
});

for (const language of ['pt','en','es']) test(`${language}: insertion feedback localizes only the two controlled media types`, () => {
  for (const type of ['图片','视频']) for (const operation of ['插入','追加']) {
    const result = localizeUiMessage(`${type}素材已${operation}到图片轨`, language);
    assert.doesNotMatch(result, /[\p{Script=Han}]/u);
  }
  assert.ok(localizeUiMessage('我的视频素材已插入到图片轨', language).includes('我的视频'));
});
