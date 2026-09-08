import {useEffect,useRef} from 'react';
import './ProjectPersistenceDialogs.css';
function LocalDialog({label,children,onCancel}) {
 const ref=useRef(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog.open)dialog.showModal();return()=>dialog.close();},[]);
 return <dialog className="local-project-dialog" ref={ref} aria-label={label} onCancel={event=>{event.preventDefault();onCancel?.();}}>{children}</dialog>;
}
export function ProjectRecoveryDialog({autosave,t}) {
 const busy=autosave.status==='restoring';
 return <LocalDialog label={t('projectRecoveryTitle')}>
  <h2>{t('projectRecoveryTitle')}</h2><p>{t('projectRecoveryHint')}</p>
  {autosave.savedAt&&<time dateTime={autosave.savedAt}>{new Date(autosave.savedAt).toLocaleString()}</time>}
  {autosave.error&&<p role="alert">{t('projectRecoveryFailure')}</p>}
  <div className="local-project-actions"><button type="button" disabled={busy} onClick={autosave.restoreRecovery}>{t(busy?'projectAutosaverestoring':'projectRecover')}</button><button type="button" disabled={busy} onClick={autosave.discardRecovery}>{t('projectStartFresh')}</button></div>
 </LocalDialog>;
}
export function ArtifactReceiptDialog({receipt,t,onClose}) {
 return <LocalDialog label={t('artifactReceiptTitle')} onCancel={onClose}>
  <h2>{t('artifactReceiptTitle')}</h2><p>{t('artifactReceiptHint')}</p>
  {(receipt.receipts || [receipt]).map(item => <section key={item.path}>
    <label>{t('artifactReceiptPath')}<input readOnly value={item.path} onFocus={event=>event.target.select()}/></label>
    <p>{t('artifactReceiptBytes')}: {item.bytes.toLocaleString()} bytes</p>
    <label>{t('artifactReceiptHash')}<input readOnly value={item.sha256} onFocus={event=>event.target.select()}/></label>
  </section>)}
  <div className="local-project-actions"><button type="button" onClick={onClose}>{t('close')}</button></div>
 </LocalDialog>;
}

export function NewProjectDialog({t,onConfirm,onCancel}) {
 return <LocalDialog label={t('projectNewTitle')} onCancel={onCancel}>
  <h2>{t('projectNewTitle')}</h2><p>{t('projectNewHint')}</p>
  <div className="local-project-actions">
   <button type="button" autoFocus onClick={onCancel}>{t('cancel')}</button>
   <button type="button" onClick={onConfirm}>{t('projectNewConfirm')}</button>
  </div>
 </LocalDialog>;
}
