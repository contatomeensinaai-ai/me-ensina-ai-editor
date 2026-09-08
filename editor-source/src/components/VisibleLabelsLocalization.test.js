import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{parse}from'@babel/parser';
function visibleText(path){const ast=parse(readFileSync(new URL(path,import.meta.url),'utf8'),{sourceType:'module',plugins:['jsx']});const texts=[];function visit(node){if(!node||typeof node!=='object')return;if(node.type==='JSXText')texts.push(node.value.trim());for(const[k,v]of Object.entries(node)){if(k==='loc'||k==='extra')continue;if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}visit(ast);return texts;}
test('descriptive super-resolution and keyboard labels participate in interface translation',()=>{
 assert.ok(!visibleText('./NanoVsrRestorationDialog.jsx').includes('4× Super Resolution'));
 assert.ok(!visibleText('./Timeline.jsx').includes('Space'));
});
