import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import vm from'node:vm';import{transformSync}from'esbuild';import*as i18n from'../i18n.js';
const jsx=(type,props)=>({type,props});
const code=transformSync(readFileSync(new URL('./panels.jsx',import.meta.url),'utf8'),{loader:'jsx',format:'cjs',jsx:'automatic'}).code;
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
function render(language){const context={module:{exports:{}},require(id){if(id==='react/jsx-runtime')return{jsx,jsxs:jsx};if(id==='../i18n.js')return i18n;return new Proxy({},{get:()=>()=>null});}};vm.runInNewContext(code,context);let selected;const tree=context.module.exports.LanguageIntro({t:i18n.createTranslator(language),onChoose:id=>selected=id});return{tree,get selected(){return selected;}};}
test('language intro uses selected copy and offers only Portuguese English Spanish',()=>{
 const ui=render('pt');const all=nodes(ui.tree);const text=all.flatMap(n=>typeof n.props?.children==='string'?[n.props.children]:[]).join(' ');assert.doesNotMatch(text,/Choose interface language|Pick a language/);
 const buttons=all.filter(n=>n.type==='button');const labels=buttons.map(n=>nodes(n).find(x=>x.type==='strong').props.children);
 assert.deepEqual(labels,['Português','English','Español']);assert.equal(buttons.length,3);buttons[0].props.onClick();assert.equal(ui.selected,'pt');
});
