import {homedir} from 'node:os';
import {join} from 'node:path';
import {accessSync,constants,statSync,realpathSync} from 'node:fs';
import {mkdir,mkdtemp,realpath} from 'node:fs/promises';

import {launcherDataDirectory,codexCandidates,pathApi} from './platform.mjs';
export function runtimeDataDirectory(env=process.env,home=homedir(),platform=process.platform) {
 return launcherDataDirectory(env,home,platform);
}
export function samePath(a,b,platform=process.platform){
 const normalize=value=>{const clean=platform==='win32'?value.replace(/^\\\\\?\\/,''):value;const result=pathApi(platform).resolve(clean);return platform==='win32'?result.toLowerCase():result;};
 return normalize(a)===normalize(b);
}
export function resolveCodexBinary({env=process.env,appBinary,platform=process.platform,home=homedir()}={}) {
 const candidates=codexCandidates({env,platform,home});
 if(appBinary&&!env.MEAI_CODEX_BIN)candidates.push(appBinary);
 for(const candidate of candidates){try{accessSync(candidate,platform==='win32'?constants.F_OK:constants.X_OK);if(statSync(candidate).isFile())return realpathSync(candidate);}catch{/* Never install or sign in. */}}
 throw Object.assign(new Error('Codex CLI is unavailable. Configure an existing native executable with MEAI_CODEX_BIN; the editor can run without it.'),{code:'CODEX_UNAVAILABLE'});
}
export function codexEnvironment(env=process.env,platform=process.platform) {
 const result={};const allowed=['PATH','HOME','CODEX_HOME'];
 if(platform==='win32')allowed.push('SYSTEMROOT','WINDIR','USERPROFILE','LOCALAPPDATA','APPDATA','TEMP','TMP','PATHEXT');
 for(const [key,value] of Object.entries(env))if(allowed.includes(key.toUpperCase()))result[key.toUpperCase()==='PATH'?'PATH':key]=value;
 if(!result.HOME)result.HOME=env.USERPROFILE||homedir();
 if(!result.PATH)result.PATH=platform==='win32'?'':'/usr/bin:/bin:/usr/sbin:/sbin';
 return result;
}
export async function createRuntimeJob(prefix) {
  const root=runtimeDataDirectory();await mkdir(root,{recursive:true,mode:0o700});
  if(!samePath(await realpath(root),root))throw new Error('Runtime data directory must not be a symlink.');
  const jobs=join(root,'jobs');await mkdir(jobs,{recursive:true,mode:0o700});
  if(!samePath(await realpath(jobs),jobs))throw new Error('Runtime job directory must not be a symlink.');
  return mkdtemp(join(jobs,prefix));
}
