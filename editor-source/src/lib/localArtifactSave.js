const messages = {
  pt: {origin:'O salvamento exige a sessão local autorizada.',session:'A sessão de salvamento expirou. Tente novamente.',route:'Rota de salvamento indisponível.',name:'Nome de arquivo inválido.',type:'Formato de arquivo não permitido.',size:'Arquivo vazio ou acima do limite de 2 GB.',busy:'Outro arquivo está sendo salvo. Aguarde.',failed:'Não foi possível confirmar a gravação no disco. Tente novamente.',receipt:'O servidor não confirmou um arquivo íntegro no disco.',content:'O conteúdo não corresponde ao formato do arquivo.',cancel:'Salvamento cancelado.'},
  en: {origin:'Saving requires the authorized local session.',session:'The save session expired. Try again.',route:'Save endpoint unavailable.',name:'Invalid file name.',type:'File format is not allowed.',size:'File is empty or exceeds the 2 GB limit.',busy:'Another file is being saved. Please wait.',failed:'Could not confirm the file was written to disk. Try again.',receipt:'The server did not confirm an intact file on disk.',content:'The content does not match the file format.',cancel:'Save canceled.'},
  es: {origin:'El guardado requiere la sesión local autorizada.',session:'La sesión de guardado caducó. Inténtelo de nuevo.',route:'Ruta de guardado no disponible.',name:'Nombre de archivo inválido.',type:'Formato de archivo no permitido.',size:'El archivo está vacío o supera el límite de 2 GB.',busy:'Se está guardando otro archivo. Espere.',failed:'No se pudo confirmar la escritura en disco. Inténtelo de nuevo.',receipt:'El servidor no confirmó un archivo íntegro en disco.',content:'El contenido no coincide con el formato del archivo.',cancel:'Guardado cancelado.'},
};
export const ARTIFACT_MIME_TYPES = {timeline:'application/zip',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm',srt:'application/x-subrip'};
export function artifactSaveError(code='failed', language='pt') {
  const copy=messages[language] || messages.pt;
  return Object.assign(new Error(copy[code] || copy.failed),{code,artifactSaveError:true});
}

export function isAbsoluteArtifactPath(path,fileName){
 if(typeof path!=='string'||typeof fileName!=='string'||!fileName||/[\\/\x00-\x1f]/.test(fileName))return false;
 if(/[\x00-\x1f]/.test(path))return false;
 const windows=/^[a-z]:[\\/]/i.test(path);
 if(!windows&&!path.startsWith('/'))return false;
 if(path.startsWith('//')||(!windows&&path.includes('\\')))return false;
 const parts=path.split(windows?/[\\/]/:/\//);
 return !parts.includes('..')&&!parts.includes('.')&&parts.at(-1)===fileName;
}
/** Only resolves after the local server has fsynced and reread the file. */
export async function saveLocalArtifact(blob, fileName, {signal, language='pt', fetchImpl=globalThis.fetch}={}) {
  const extension=String(fileName).split('.').pop().toLowerCase();
  if(!ARTIFACT_MIME_TYPES[extension]) throw artifactSaveError('type',language);
  if(!(blob instanceof Blob) || blob.size===0) throw artifactSaveError('size',language);
  try {
    const session=await fetchImpl('/api/local-artifacts/session',{signal,cache:'no-store',credentials:'same-origin',headers:{'x-timeline-language':language}});
    if(!session.ok) throw artifactSaveError('session',language);
    const {capability}=await session.json();
    if(typeof capability!=='string' || !/^[a-f0-9]{64}$/.test(capability)) throw artifactSaveError('session',language);
    const response=await fetchImpl('/api/local-artifacts',{method:'POST',signal,credentials:'same-origin',headers:{'content-type':ARTIFACT_MIME_TYPES[extension],'x-timeline-capability':capability,'x-timeline-filename':encodeURIComponent(fileName),'x-timeline-language':language},body:blob});
    const receipt=await response.json();
    if(!response.ok) throw artifactSaveError(receipt.code,language);
    if(receipt.verified!==true || receipt.bytes!==blob.size || !/^[a-f0-9]{64}$/.test(receipt.sha256) || !isAbsoluteArtifactPath(receipt.path,receipt.fileName) || typeof receipt.fileName!=='string' || !receipt.fileName.endsWith(`.${extension}`)) throw artifactSaveError('receipt',language);
    return receipt;
  } catch(error) {
    if(signal?.aborted || error?.name==='AbortError') throw new DOMException(artifactSaveError('cancel',language).message,'AbortError');
    if(error.artifactSaveError) throw error;
    throw artifactSaveError('failed',language);
  }
}
