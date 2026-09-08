import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
const root=dirname(fileURLToPath(import.meta.url));
const source=join(root,'editor-source');
async function run(args){await new Promise((ok,fail)=>{const p=spawn(process.execPath,args,{cwd:source,stdio:'inherit',shell:false,env:{...process.env,PATH:dirname(process.execPath)+':'+(process.env.PATH||'/usr/bin:/bin')}});p.once('error',fail);p.once('exit',code=>code===0?ok():fail(Error('A preparação não terminou. Verifique a conexão e tente abrir novamente.')));});}
export function validateVendor(e){
 const prefix='https://raw.githubusercontent.com/MartinDelophy/ai-video-editor/064677063ec618d6bd27e1adcfa6be078615dda2/';
 if(!/^(public|src)\/vendor\/[a-zA-Z0-9_./-]+$/.test(e.path)||e.path.split('/').includes('..')||!e.url.startsWith(prefix)||e.url!==prefix+e.path||!/^[a-f0-9]{64}$/.test(e.sha256)||!(/\.(js|mjs|wasm)$/).test(e.path))throw Error('Dependência fora da lista aprovada.');
 return e;
}
async function main(){
 if(process.argv.includes('--validate-only')){for(const e of JSON.parse(await readFile(join(root,'vendor-downloads.json'),'utf8')))validateVendor(e);console.log('Manifesto de dependências válido.');return;}
 try{if((await stat(join(root,'editor/dist/index.html'))).isFile()){console.log('Editor já preparado.');return;}}catch{}
 console.log('Preparando o editor pela primeira vez. Baixando bibliotecas públicas; nenhum modelo de IA ou vídeo será enviado.');
 const entries=JSON.parse(await readFile(join(root,'vendor-downloads.json'),'utf8'));
 for(const entry of entries){const e=validateVendor(entry),target=resolve(source,e.path);let data;try{data=await readFile(target);}catch{}
  if(data&&createHash('sha256').update(data).digest('hex')===e.sha256)continue;
  const response=await fetch(e.url,{redirect:'error',signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Não foi possível baixar uma biblioteca. Tente novamente com internet.');
  data=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(data).digest('hex')!==e.sha256)throw Error('A biblioteca recebida não passou na verificação. Instalação interrompida.');
  await mkdir(dirname(target),{recursive:true});await writeFile(target+'.part',data);await rename(target+'.part',target);console.log('Biblioteca verificada: '+e.path);
 }
 await run([join(root,'lib/node_modules/npm/bin/npm-cli.js'),'ci','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org']);
 await mkdir(join(root,'editor'),{recursive:true});
 await run([join(source,'node_modules/vite/bin/vite.js'),'build','--outDir',join(root,'editor/dist')]);
 console.log('Editor preparado. Nas próximas aberturas esta etapa será reutilizada.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
