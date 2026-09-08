import {runtimeDataDirectory} from '../runtime-config.mjs';
import {randomBytes, randomUUID, timingSafeEqual, createHash} from 'node:crypto';
import {createLoopbackOriginPolicy} from './loopback-origins.mjs';
import {mkdir, realpath, open, link, unlink} from 'node:fs/promises';
import {resolve, join, extname} from 'node:path';
import {ARTIFACT_MIME_TYPES, artifactSaveError} from '../src/lib/localArtifactSave.js';

export const ARTIFACT_DIRECTORY=join(runtimeDataDirectory(),'exports');
const DEFAULT_MAX_BYTES=2*1024*1024*1024;
const fail=(code,status=400)=>Object.assign(new Error(code),{code,status});
function validateMagic(prefix,extension) {
  if(extension==='srt') return;
  const hex=prefix.subarray(0,4).toString('hex');
  const valid=extension==='timeline' ? hex==='504b0304' : extension==='webm' ? hex==='1a45dfa3' : prefix.subarray(4,8).toString()==='ftyp';
  if(!valid) throw fail('content',415);
}

export function createLocalArtifactMiddleware({origin='http://127.0.0.1:5201',directory=ARTIFACT_DIRECTORY,maxBytes=DEFAULT_MAX_BYTES}={}) {
  const policy=createLoopbackOriginPolicy(origin);
  const capabilities=new Map(policy.origins.map(value=>[value,randomBytes(32).toString('hex')]));
  let active=false;
  return async (req,res,next)=>{
    if(!req.url?.startsWith('/api/local-artifacts')){next();return;}
    const language=req.headers['x-timeline-language'] || 'pt';
    const send=(status,value)=>{if(res.destroyed || res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    const reject=(code,status)=>send(status,{code,error:artifactSaveError(code,language).message});
    const requestOrigin=policy.resolve(req);
    if(!requestOrigin){reject('origin',403);return;}
    const capability=capabilities.get(requestOrigin);
    if(req.method==='GET' && req.url==='/api/local-artifacts/session'){send(200,{capability,maxBytes});return;}
    if(req.method!=='POST'||req.url!=='/api/local-artifacts'){reject('route',404);return;}
    const supplied=Buffer.from(req.headers['x-timeline-capability']||'');
    const expected=Buffer.from(capability);
    if(req.headers.origin!==requestOrigin || supplied.length!==expected.length || !timingSafeEqual(supplied,expected)){reject('session',403);return;}
    let partialPath,finalPath,handle,published=false,acquired=false;
    const cancel=()=>{if(!res.writableEnded)req.destroy();};
    try {
      let name;
      try{name=decodeURIComponent(req.headers['x-timeline-filename']||'');}catch{throw fail('name');}
      if(!name || name.length>180 || /[\\/\x00-\x1f\x7f]/.test(name) || name.startsWith('.') || name.includes('..')) throw fail('name');
      const extension=extname(name).slice(1).toLowerCase();
      if(!ARTIFACT_MIME_TYPES[extension] || req.headers['content-type']?.split(';')[0]!==ARTIFACT_MIME_TYPES[extension]) throw fail('type',415);
      const declared=req.headers['content-length'];
      if(declared!==undefined && (!/^\d+$/.test(declared) || Number(declared)>maxBytes || Number(declared)===0)) throw fail('size',413);
      if(active) throw fail('busy',409);
      active=true;acquired=true;
      req.setTimeout(120000,()=>req.destroy());res.on('close',cancel);
      const root=resolve(directory);
      await mkdir(root,{recursive:true,mode:0o700});
      if(await realpath(root)!==root) throw fail('failed',500);
      const stem=name.slice(0,-extname(name).length).replace(/[^\p{L}\p{N}_ -]/gu,'_').slice(0,100) || 'timeline';
      const unique=`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}`;
      const fileName=`${stem}-${unique}.${extension}`;
      finalPath=join(root,fileName);partialPath=join(root,`.${unique}.partial`);
      handle=await open(partialPath,'wx+',0o600);
      let bytes=0,prefix=Buffer.alloc(0);
      const incomingHash=createHash('sha256');
      for await(const chunk of req) {
        if(req.aborted || res.destroyed) throw fail('cancel');
        bytes+=chunk.length;
        if(bytes>maxBytes) throw fail('size',413);
        if(prefix.length<16) prefix=Buffer.concat([prefix,chunk.subarray(0,16-prefix.length)]);
        incomingHash.update(chunk);
        let offset=0;
        while(offset<chunk.length){const result=await handle.write(chunk,offset,chunk.length-offset);if(!result.bytesWritten)throw fail('failed',500);offset+=result.bytesWritten;}
      }
      if(!bytes || (declared!==undefined && bytes!==Number(declared))) throw fail('size',413);
      validateMagic(prefix,extension);
      await handle.sync();
      const writtenHash=createHash('sha256'),buffer=Buffer.alloc(65536);let verifiedBytes=0;
      while(true){const result=await handle.read(buffer,0,buffer.length,verifiedBytes);if(!result.bytesRead)break;writtenHash.update(buffer.subarray(0,result.bytesRead));verifiedBytes+=result.bytesRead;}
      const sha256=incomingHash.digest('hex');
      if(verifiedBytes!==bytes || writtenHash.digest('hex')!==sha256) throw fail('receipt',500);
      await handle.close();handle=null;
      if(req.aborted || res.destroyed) throw fail('cancel');
      // Hard-link publication is atomic and fails if a destination already exists.
      await link(partialPath,finalPath);published=true;
      await unlink(partialPath);partialPath=null;
      const folder=await open(root,'r');try{await folder.sync();}finally{await folder.close();}
      if(req.aborted || res.destroyed) throw fail('cancel');
      send(201,{path:finalPath,fileName,bytes,sha256,verified:true});
    } catch(error) {
      await handle?.close().catch(()=>{});
      if(partialPath) await unlink(partialPath).catch(()=>{});
      if(published) await unlink(finalPath).catch(()=>{});
      reject(error.status?error.code:'failed',error.status || 500);
    } finally {
      res.off('close',cancel);req.socket?.setTimeout(0);
      if(acquired) active=false;
    }
  };
}
export function localArtifactPlugin(options={}) {
  const install=server=>{server.middlewares.use(createLocalArtifactMiddleware(options));};
  return {name:'verified-local-artifact-save',configureServer:install,configurePreviewServer:install};
}
