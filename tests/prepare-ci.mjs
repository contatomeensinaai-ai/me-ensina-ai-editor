import {cp,mkdir,access} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
const root=process.cwd(),bin=dirname(process.execPath);
await mkdir(join(root,'bin'),{recursive:true});await cp(process.execPath,join(root,'bin',process.platform==='win32'?'node.exe':'node'));
for(const path of [join(bin,'node_modules/npm'),resolve(bin,'../lib/node_modules/npm')]){try{await access(join(path,'bin/npm-cli.js'));await cp(path,join(root,'lib/node_modules/npm'),{recursive:true,dereference:true});console.log('CI runtime prepared');process.exit(0);}catch{}}
throw Error('Cannot locate npm beside the CI Node runtime');
