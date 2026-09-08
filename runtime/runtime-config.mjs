import {homedir} from 'node:os';
import {join,resolve,isAbsolute,delimiter} from 'node:path';
import {accessSync,constants,statSync,realpathSync} from 'node:fs';
import {mkdir,mkdtemp,realpath} from 'node:fs/promises';

export function runtimeDataDirectory(env=process.env,home=homedir()) {
  const target=env.MEAI_DATA_DIR || join(home,'Library','Application Support','Me Ensina AI');
  if(!isAbsolute(target))throw new Error('MEAI_DATA_DIR must be an absolute path.');
  return resolve(target);
}
export function resolveCodexBinary({env=process.env,appBinary='/Applications/Codex.app/Contents/Resources/codex'}={}) {
  const explicit=env.MEAI_CODEX_BIN;
  if(explicit&&!isAbsolute(explicit))throw new Error('MEAI_CODEX_BIN must be an absolute executable path.');
  const candidates=explicit?[explicit]:[...(env.PATH||'').split(delimiter).filter(isAbsolute).map(directory=>join(directory,'codex')),appBinary];
  for(const candidate of candidates){try{accessSync(candidate,constants.X_OK);if(statSync(candidate).isFile())return realpathSync(candidate);}catch{/* Try next installed executable; never install or sign in. */}}
  throw Object.assign(new Error('Codex is not available. Install Codex or configure MEAI_CODEX_BIN.'),{code:'CODEX_UNAVAILABLE'});
}
export function codexEnvironment(env=process.env) {
  return {PATH:env.PATH||'/usr/bin:/bin:/usr/sbin:/sbin',HOME:env.HOME||homedir(),...(env.CODEX_HOME?{CODEX_HOME:env.CODEX_HOME}:{})};
}
export async function createRuntimeJob(prefix) {
  const root=runtimeDataDirectory();await mkdir(root,{recursive:true,mode:0o700});
  if(await realpath(root)!==root)throw new Error('Runtime data directory must not be a symlink.');
  const jobs=join(root,'jobs');await mkdir(jobs,{recursive:true,mode:0o700});
  if(await realpath(jobs)!==jobs)throw new Error('Runtime job directory must not be a symlink.');
  return mkdtemp(join(jobs,prefix));
}
