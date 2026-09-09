const COPY={
  pt:{prompt:'Descreva a imagem em até 2.000 caracteres.',connection:'Não foi possível conectar ao gerador local.',session:'A sessão do gerador expirou. Tente novamente.',busy:'Uma imagem já está sendo gerada. Aguarde ou cancele.',cancel:'Geração cancelada.',timeout:'A geração excedeu cinco minutos. Tente novamente.',invalidImage:'O Codex não devolveu uma imagem válida. Nada foi aplicado.',start:'Não foi possível iniciar o Codex. Verifique a instalação e o login.',failed:'O Codex não concluiu a imagem. Verifique a conta e tente novamente.'},
  en:{prompt:'Describe the image in up to 2,000 characters.',connection:'Could not connect to the local generator.',session:'The generator session expired. Try again.',busy:'An image is already being generated. Wait or cancel.',cancel:'Generation canceled.',timeout:'Generation exceeded five minutes. Try again.',invalidImage:'Codex did not return a valid image. Nothing was applied.',start:'Could not start Codex. Check the installation and login.',failed:'Codex did not finish the image. Check your account and try again.'},
  es:{prompt:'Describe la imagen en un máximo de 2.000 caracteres.',connection:'No se pudo conectar con el generador local.',session:'La sesión del generador caducó. Inténtalo de nuevo.',busy:'Ya se está generando una imagen. Espera o cancela.',cancel:'Generación cancelada.',timeout:'La generación superó cinco minutos. Inténtalo de nuevo.',invalidImage:'Codex no devolvió una imagen válida. No se aplicó nada.',start:'No se pudo iniciar Codex. Comprueba la instalación y el acceso.',failed:'Codex no terminó la imagen. Comprueba tu cuenta e inténtalo de nuevo.'},
};
export function supportingImageErrorMessage(code,language='pt') {return (COPY[language]||COPY.en)[code] || (COPY[language]||COPY.en).failed;}
export async function generateSupportingImage(prompt,{signal,language='pt'}={}) {
  const failure=code=>Object.assign(new Error(supportingImageErrorMessage(code,language)),{code});
  if(typeof prompt!=='string'||!prompt.trim()||prompt.length>2000)throw failure('prompt');
  try{
    const session=await fetch('/api/supporting-images/session',{signal,cache:'no-store'});
    if(!session.ok)throw failure('connection');
    const {capability}=await session.json();
    const response=await fetch('/api/supporting-images/generate',{method:'POST',signal,headers:{'Content-Type':'application/json','X-Timeline-Capability':capability},body:JSON.stringify({prompt:prompt.trim()})});
    if(!response.ok){let code='failed';try{code=(await response.json()).code||code;}catch{/* Keep generic error. */}throw failure(code);}
    if(!response.headers.get('content-type')?.startsWith('image/png'))throw failure('invalidImage');
    const blob=await response.blob();
    if(!blob.size||blob.size>25*1024*1024)throw failure('invalidImage');
    return new File([blob],`codex-support-${Date.now()}.png`,{type:'image/png'});
  }catch(error){if(error.name==='AbortError'||error.code)throw error;throw failure('connection');}
}
