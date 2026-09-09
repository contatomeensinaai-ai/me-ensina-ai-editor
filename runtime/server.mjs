import {createServer} from 'node:http';
import {constants} from 'node:fs';
import {lstat,realpath,open,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join,sep,extname} from 'node:path';
import {isMainModule} from './platform.mjs';
import {runtimeDataDirectory,resolveCodexBinary,samePath} from './runtime-config.mjs';
import {createKeywordMiddleware} from './server/codex-keywords.mjs';
import {createLocalArtifactMiddleware} from './server/local-artifacts.mjs';
import {createSupportingImageMiddleware} from './server/supporting-image-generation.mjs';
import {createSupportingPlanMiddleware} from './server/supporting-image-planning.mjs';

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.onnx':'application/octet-stream'};
export function parsePort(args){if(args.length===0)return 5201;if(args.length!==2||args[0]!=='--port'||!/^\d+$/.test(args[1])||Number(args[1])<1024||Number(args[1])>65535)throw new Error('Usage: node runtime/server.mjs [--port 5201]');return Number(args[1]);}
export function byteRange(value,size){
 if(value===undefined)return null;
 const match=/^bytes=(\d*)-(\d*)$/.exec(value);
 if(!match||(!match[1]&&!match[2])||size===0)throw new Error('range');
 let start,end;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)throw new Error('range');start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)throw new Error('range');
 return{start,end};
}
export async function safeStaticFile(root,requestUrl){
 const raw=(requestUrl||'/').split('?')[0];let decoded;
 try{decoded=decodeURIComponent(raw);}catch{throw new Error('path');}
 if(!decoded.startsWith('/')||/[\\\x00-\x1f]/.test(decoded)||decoded.split('/').some(part=>part==='.'||part==='..'||part.startsWith('.')||/[<>:"|?*]/.test(part)||(process.platform==='win32'&&(/[. ]$/.test(part)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))))throw new Error('path');
 const parts=(decoded==='/'?'/index.html':decoded).slice(1).split('/').filter(Boolean);
 let target=root;
 for(let index=0;index<parts.length;index++){
  target=join(target,parts[index]);const entry=await lstat(target);
  if(entry.isSymbolicLink()|| (index<parts.length-1&&!entry.isDirectory()))throw new Error('path');
 }
 if(target===root||!target.startsWith(root+sep))throw new Error('path');
 // Defense against a directory symlink being swapped after the lstat walk.
 if(!samePath(await realpath(target),target))throw new Error('path');
 return target;
}
export async function createRuntimeServer({port=5201,distDirectory=fileURLToPath(new URL('../editor/dist/',import.meta.url)),dataDirectory=runtimeDataDirectory(),keywordRun,imageRun,planRun}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid local port.');
 const root=resolve(distDirectory),dataRoot=resolve(dataDirectory);
 if(!samePath(await realpath(root),root))throw new Error('Editor directory must not be a symlink.');
 if(!(await lstat(join(root,'index.html'))).isFile())throw new Error('Editor files unavailable.');
 await mkdir(dataRoot,{recursive:true,mode:0o700});if(!samePath(await realpath(dataRoot),dataRoot))throw new Error('Data directory must not be a symlink.');
 let handlers=[],actualPort;
 const server=createServer((req,res)=>{
  const fail=(status,message)=>{if(res.headersSent){res.destroy();return;}res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:message}));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  const host=req.headers.host,expectedOrigin=`http://${host}`;
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||![`127.0.0.1:${actualPort}`,`localhost:${actualPort}`].includes(host)||(req.headers.origin!==undefined&&req.headers.origin!==expectedOrigin)){fail(403,'Local session required');return;}
  const path=req.url?.split('?')[0];
  if(['/api/health','/api/status'].includes(path)){
   if(req.method!=='GET'||(req.headers['sec-fetch-site']&&!['none','same-origin'].includes(req.headers['sec-fetch-site']))){fail(403,'Local session required');return;}
   let codexAvailable=false;try{resolveCodexBinary();codexAvailable=true;}catch{/* No account or filesystem details are exposed. */}
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,app:'me-ensina-ai-editor',runtimeVersion:'0.2.1',port:actualPort,editorAvailable:true,codexAvailable}));return;
  }
  let index=0;
  const next=()=>{
   if(index<handlers.length){Promise.resolve(handlers[index++](req,res,next)).catch(()=>fail(500,'Local operation failed'));return;}
   serveStatic().catch(()=>fail(404,'File not found'));
  };
  async function serveStatic(){
   if(req.url?.startsWith('/api/')){fail(404,'Route not found');return;}
   if(!['GET','HEAD'].includes(req.method)){fail(405,'Method not allowed');return;}
   const file=await safeStaticFile(root,req.url);const handle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
   try{
    const info=await handle.stat();if(!info.isFile())throw new Error('path');
    let range;try{range=byteRange(req.headers.range,info.size);}catch{res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
    const headers={'Content-Type':MIME[extname(file).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache','Content-Length':range?range.end-range.start+1:info.size};
    if(range)headers['Content-Range']=`bytes ${range.start}-${range.end}/${info.size}`;
    res.writeHead(range?206:200,headers);
    if(req.method==='HEAD'){res.end();return;}
    await new Promise((resolve,reject)=>{const stream=handle.createReadStream({...range,autoClose:false});stream.on('error',reject);res.on('close',()=>{stream.destroy();resolve();});stream.on('end',resolve);stream.pipe(res);});
   }finally{await handle.close();}
  }
  next();
 });
 server.requestTimeout=120000;server.headersTimeout=15000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 actualPort=server.address().port;
 const origin=`http://127.0.0.1:${actualPort}`;
 handlers=[createKeywordMiddleware({origin,...(keywordRun?{run:keywordRun}:{})}),createLocalArtifactMiddleware({origin,directory:join(dataRoot,'exports')}),createSupportingImageMiddleware({origin,...(imageRun?{run:imageRun}:{})}),createSupportingPlanMiddleware({origin,...(planRun?{run:planRun}:{})})];
 return{server,port:actualPort,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
if(isMainModule(import.meta.url,process.argv[1])){
 createRuntimeServer({port:parsePort(process.argv.slice(2))}).then(({port,close})=>{console.log(`Me Ensina AI: http://127.0.0.1:${port}/`);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>close().then(()=>process.exit(0)));}).catch(()=>{console.error('Não foi possível iniciar o Me Ensina AI. Verifique a pasta do editor, as permissões e se a porta está livre.');process.exitCode=1;});
}
