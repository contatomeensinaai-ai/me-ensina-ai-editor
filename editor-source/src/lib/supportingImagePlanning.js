import {createSupportingSnapshot,validateSupportingPlan} from './supportingImages.js';
import {getCaptionTimeline} from './timeline.js';
import {supportingImageErrorMessage} from './supportingImageGeneration.js';
const copy={pt:{planInput:'Selecione de 1 a 12 imagens e até 100 legendas para distribuir com o Codex.',planResult:'O Codex não devolveu uma distribuição válida. Nada foi aplicado.',planTimeout:'A análise excedeu três minutos. Tente novamente.'},en:{planInput:'Select 1 to 12 images and up to 100 captions for Codex placement.',planResult:'Codex did not return a valid placement. Nothing was applied.',planTimeout:'Analysis exceeded three minutes. Try again.'},es:{planInput:'Selecciona de 1 a 12 imágenes y hasta 100 subtítulos para distribuir con Codex.',planResult:'Codex no devolvió una distribución válida. No se aplicó nada.',planTimeout:'El análisis superó tres minutos. Inténtalo de nuevo.'}};
export function supportingPlanErrorMessage(code,language='pt'){return(copy[language]||copy.en)[code]||supportingImageErrorMessage(code,language);}
export async function createImageThumbnail(asset){
 const image=await createImageBitmap(asset.blob);
 try{
  const factor=Math.min(1,512/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*factor));canvas.height=Math.max(1,Math.round(image.height*factor));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.75));if(!blob)throw Error('thumbnail');
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return{id:asset.id,name:String(asset.name||'image').slice(0,200),mime:'image/jpeg',base64:btoa(binary)};
 }finally{image.close();}
}
export async function planSupportingImages(context,assets,{signal,language='pt',thumbnail=createImageThumbnail}={}){
 const error=code=>Object.assign(new Error(supportingPlanErrorMessage(code,language)),{code});
 if(!assets?.length||assets.length>12||!context.captionSegments?.length||context.captionSegments.length>100)throw error('planInput');
 const snapshot=createSupportingSnapshot(context),captions=context.captionSegments.map(({id,text})=>({id,text}));
 try{
  const images=await Promise.all(assets.map(thumbnail));if(signal?.aborted)throw new DOMException('Canceled','AbortError');
  const session=await fetch('/api/supporting-plan/session',{signal,cache:'no-store'});if(!session.ok)throw error('connection');const{capability}=await session.json();
  const response=await fetch('/api/supporting-plan',{method:'POST',signal,headers:{'Content-Type':'application/json','X-Timeline-Capability':capability},body:JSON.stringify({captions,images})});
  const result=await response.json();if(!response.ok)throw error(result.code||'failed');
  if(!Array.isArray(result.items)||!result.items.length||result.items.length>assets.length)throw error('planResult');
  const timeline=getCaptionTimeline(context.captionSegments,context.timelineDuration);const usedImages=new Set(),usedCaptions=new Set();
  const items=result.items.map(({assetId,captionId})=>{const index=context.captionSegments.findIndex(c=>c.id===captionId);if(index<0||!assets.some(a=>a.id===assetId)||usedImages.has(assetId)||usedCaptions.has(captionId))throw error('planResult');usedImages.add(assetId);usedCaptions.add(captionId);return{assetId,captionId,start:timeline[index].start,end:timeline[index].end,topRatio:0.4,videoPosition:{x:0.5,y:0.5},imagePosition:{x:0.5,y:0.5}};});
  return validateSupportingPlan({version:1,snapshot,items},{...context,assets});
 }catch(e){if(e.name==='AbortError'||e.code||/^supporting[A-Z]/.test(e.message))throw e;throw error('failed');}
}
export const supportingPlanningErrorMessage = supportingPlanErrorMessage;
