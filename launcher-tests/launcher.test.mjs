import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,chmod,rm,copyFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {discoverCodex,launchEditor,prepareEditor,editorHealth} from '../launcher/start-editor.mjs';
const launcher=resolve(import.meta.dirname,'../launcher/open-editor.command');
async function fixture(t){const root=await realpath(await mkdtemp(join(tmpdir(),'meai-launcher-')));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
async function file(path,text='',mode=0o600){await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,text);await chmod(path,mode);return path;}
const child=()=>Object.assign(new EventEmitter(),{unref(){}});
async function pkg(root,compiled=true){await file(join(root,'bin/node'),'fixture executable',0o700);await file(join(root,'runtime/server.mjs'));if(compiled)await file(join(root,'editor/dist/index.html'));else await file(join(root,'setup-editor.mjs'));return root;}
test('discovers optional CLI from absolute PATH and variant application resources, ignores GUI binary',async t=>{
 const root=await fixture(t);const app=join(root,'Applications/Codex Canary.app/Contents');
 await file(join(app,'MacOS/Codex'),'GUI',0o700);
 assert.equal(await discoverCodex({env:{PATH:'.'},home:root,applications:[join(root,'Applications')]}),null);
 const cli=await file(join(app,'Resources/app.asar.unpacked/bin/codex-aarch64-apple-darwin'),'CLI',0o700);
 assert.equal(await discoverCodex({env:{PATH:''},home:root,applications:[join(root,'Applications')]}),cli);
 const pathCli=await file(join(root,'local bin/codex'),'CLI',0o700);
 assert.equal(await discoverCodex({env:{PATH:join(root,'local bin')},applications:[]}),pathCli);
 assert.equal(await discoverCodex({env:{MEAI_CODEX_BIN:'relative/codex'},applications:[]}),null);
 assert.equal(await discoverCodex({env:{MEAI_CODEX_BIN:pathCli},applications:[]}),pathCli);
});
test('existing editor is reused without starting, preparing, opening or finding CLI',async()=>{
 const fail=()=>{throw new Error('must not run');};
 assert.deepEqual(await launchEditor({probe:async()=>({app:'me-ensina-ai-editor',codexAvailable:false}),spawnProcess:fail,prepare:fail,discover:fail,occupied:fail}),{url:'http://127.0.0.1:5201/',reused:true,codexAvailable:false});
});
test('foreign occupied port is preserved',async()=>{
 await assert.rejects(launchEditor({probe:async()=>null,occupied:async()=>true,spawnProcess:()=>{throw Error('must not spawn');}}),/ocupada/);
});
test('editor starts with embedded Node without CLI, no install or browser invocation',async t=>{
 const root=await fixture(t);await pkg(root);const calls=[];let probes=0;
 const result=await launchEditor({packageDirectory:root,env:{MEAI_DATA_DIR:join(root,'data'),MEAI_CODEX_BIN:'/missing'},probe:async()=>++probes===1?null:{app:'me-ensina-ai-editor',codexAvailable:false},occupied:async()=>false,discover:async()=>null,spawnProcess:(...args)=>{calls.push(args);return child();},wait:async()=>{},openBrowser:false});
 assert.equal(result.codexAvailable,false);assert.equal(result.reused,false);assert.equal(calls.length,1);
 const [command,args,options]=calls[0];assert.equal(command,join(root,'bin/node'));assert.deepEqual(args,[join(root,'runtime/server.mjs'),'--port','5201']);assert.equal(options.shell,false);assert.equal(options.env.MEAI_CODEX_BIN,undefined);assert.equal(options.env.MEAI_DATA_DIR,join(root,'data'));
});
test('setup runs once with embedded Node only when dist is absent and output is verified',async t=>{
 const root=await fixture(t);await pkg(root,false);const calls=[];
 const spawnProcess=(...args)=>{calls.push(args);const process=child();queueMicrotask(async()=>{await file(join(root,'editor/dist/index.html'));process.emit('exit',0);});return process;};
 await prepareEditor({root,node:join(root,'bin/node'),spawnProcess,env:{PATH:''}});
 await prepareEditor({root,node:join(root,'bin/node'),spawnProcess});
 assert.equal(calls.length,1);assert.deepEqual(calls[0].slice(0,2),[join(root,'bin/node'),[join(root,'setup-editor.mjs')]]);assert.equal(calls[0][2].shell,false);
});
test('failed or missing setup output aborts before runtime startup',async t=>{
 const root=await fixture(t);await pkg(root,false);
 for(const code of [1,0])await assert.rejects(prepareEditor({root,node:join(root,'bin/node'),spawnProcess:()=>{const process=child();queueMicrotask(()=>process.emit('exit',code));return process;}}),code?/falhou/:/sem produzir/);
});
test('health rejects another app and fetch errors',async()=>{
 assert.equal(await editorHealth({fetchImpl:async()=>({ok:true,json:async()=>({app:'other'})})}),null);
 assert.equal(await editorHealth({fetchImpl:async()=>{throw Error('offline');}}),null);
});
test('native shell validates pinned release and rejects unsafe configuration without downloading',async t=>{
 const root=await fixture(t);const command=join(root,'open-editor.command');await copyFile(launcher,command);
 const valid={version:'0.1.1',url:'https://github.com/contatomeensinaai-ai/me-ensina-ai-editor/releases/download/v0.1.1-pilot/package.zip',sha256:'a'.repeat(64),packageDirectory:'Me-Ensina-AI-Mac-Apple-Silicon-0.1.1'};
 await file(join(root,'release.json'),JSON.stringify(valid));assert.match(execFileSync('/bin/bash',[command,'--validate-release'],{encoding:'utf8'}),/válido/);
 for(const patch of [{sha256:'pending'},{packageDirectory:'../escape'},{version:'../../'},{url:'http://github.com/a/b/releases/download/v/a.zip'},{url:'https://evil.example/a.zip'},{url:'https://github.com@evil.example/a.zip'}]){
  await file(join(root,'release.json'),JSON.stringify({...valid,...patch}));assert.throws(()=>execFileSync('/bin/bash',[command,'--validate-release'],{stdio:'pipe'}));
 }
});
test('concurrent setup is rejected without altering its lock or spawning another installer',async t=>{
 const root=await fixture(t);await pkg(root,false);await mkdir(join(root,'.setup-in-progress'));
 await assert.rejects(prepareEditor({root,node:join(root,'bin/node'),spawnProcess:()=>{throw Error('must not spawn');}}),/em andamento/);
});
