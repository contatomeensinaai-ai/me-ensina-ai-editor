import {useCallback,useEffect,useRef,useState} from 'react';
import {checkpointToArchive,getProjectCheckpointRevision,PROJECT_CHECKPOINT_CONFLICT,projectCheckpointStore,projectSnapshotFingerprint} from '../lib/projectPersistence.js';

const INITIAL_STATE = {status:'loading',savedAt:null,error:null,recovery:null};

/** State machine shared by the React hook and deterministic lifecycle tests. */
export function createProjectAutosaveController({store=projectCheckpointStore,restore,delay=1000}={}) {
  let state={...INITIAL_STATE};
  let latest=null;
  let latestFingerprint=null;
  let savedFingerprint=null;
  let expectedRevision=null;
  let conflicted=false;
  let enabled=false;
  let disposed=false;
  let saving=false;
  let initializing=false;
  let timer=null;
  const listeners=new Set();
  const publish=patch=>{
    if(disposed)return;
    state={...state,...patch};
    for(const listener of listeners)listener(state);
  };
  const stopTimer=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
  function schedule() {
    stopTimer();
    if(disposed||!enabled||conflicted||saving||!latest)return;
    if(latestFingerprint===savedFingerprint){publish({status:'saved',error:null});return;}
    publish({status:'idle',error:null});
    timer=setTimeout(()=>{timer=null;void saveLatest();},Math.max(0,delay));
  }
  async function saveLatest() {
    if(disposed||!enabled||conflicted||saving||!latest||latestFingerprint===savedFingerprint)return;
    const snapshot=latest;
    const fingerprint=latestFingerprint;
    saving=true;
    publish({status:'saving',error:null});
    try {
      const checkpoint=await store.save(snapshot,{expectedRevision});
      if(disposed)return;
      expectedRevision=getProjectCheckpointRevision(checkpoint);
      savedFingerprint=fingerprint;
      publish({status:latestFingerprint===fingerprint?'saved':'idle',savedAt:checkpoint.savedAt,error:null});
    } catch(error) {
      if(error?.code===PROJECT_CHECKPOINT_CONFLICT)conflicted=true;
      publish({status:'error',error:error instanceof Error?error:new Error(String(error))});
    } finally {
      saving=false;
      // Never spin on a failing snapshot (quota, permission). A newer edit or Retry is required.
      if(!disposed&&!conflicted&&latestFingerprint!==fingerprint)schedule();
    }
  }
  async function initialize() {
    if(disposed||conflicted||initializing||enabled)return;
    initializing=true;
    publish({status:'loading',error:null});
    try {
      const checkpoint=await store.load();
      if(disposed)return;
      if(checkpoint)publish({status:'recovery',recovery:checkpoint,savedAt:checkpoint.savedAt});
      else {enabled=true;publish({status:'idle'});schedule();}
    } catch(error) {
      publish({status:'error',error:error instanceof Error?error:new Error(String(error))});
    } finally {initializing=false;}
  }
  async function restoreRecovery() {
    if(disposed||conflicted||!state.recovery||state.status==='restoring')return false;
    stopTimer();
    enabled=false;
    const checkpoint=state.recovery;
    publish({status:'restoring',error:null});
    try {
      if(typeof restore!=='function')throw new Error('Autosave recovery is not connected to the editor.');
      const result=await restore(checkpointToArchive(checkpoint));
      if(result===false)throw new Error('Project restoration did not complete.');
      if(disposed)return false;
      expectedRevision=getProjectCheckpointRevision(checkpoint);
      // Treat the fully hydrated editor as the baseline, not any partial state seen mid-restore.
      savedFingerprint=latestFingerprint;
      enabled=true;
      publish({status:'saved',savedAt:checkpoint.savedAt,recovery:null,error:null});
      return true;
    } catch(error) {
      publish({status:'error',recovery:checkpoint,error:error instanceof Error?error:new Error(String(error))});
      return false;
    }
  }
  function discardRecovery() {
    if(disposed||conflicted||!state.recovery||state.status==='restoring')return;
    // A decline is NOT a delete: the previous checkpoint remains until an atomic replacement succeeds.
    // Only the revision shown in this recovery decision is authorized to be replaced.
    expectedRevision=getProjectCheckpointRevision(state.recovery);
    enabled=true;
    savedFingerprint=null;
    publish({status:'idle',recovery:null,error:null});
    schedule();
  }
  return {
    getState:()=>state,
    subscribe(listener){listeners.add(listener);listener(state);return()=>listeners.delete(listener);},
    update(snapshot){
      if(disposed)return;
      const fingerprint=projectSnapshotFingerprint(snapshot);
      latest=snapshot;
      if(fingerprint===latestFingerprint)return;
      latestFingerprint=fingerprint;
      if(enabled)schedule();
    },
    initialize,restoreRecovery,discardRecovery,
    retry(){
      // Retry must not adopt another tab's revision. Keep this editor's work intact
      // for explicit export/reload/review rather than silently overwriting it.
      if(disposed||conflicted)return;
      if(!enabled){if(state.recovery)void restoreRecovery();else void initialize();}
      else schedule();
    },
    dispose(){disposed=true;stopTimer();listeners.clear();},
  };
}

/**
 * snapshot: createProjectArchive inputs. restore: awaited archive-like hydration;
 * return false or throw on ANY failure. No persistence before the recovery decision.
 */
export function useProjectAutosave({snapshot,restore,delay=1000,store=projectCheckpointStore}) {
  const [state,setState]=useState(INITIAL_STATE);
  const controllerRef=useRef(null);
  const snapshotRef=useRef(snapshot);
  const restoreRef=useRef(restore);
  const fingerprint=projectSnapshotFingerprint(snapshot);
  // Refs are updated in an effect so abandoned concurrent renders cannot become checkpoints.
  useEffect(()=>{snapshotRef.current=snapshot;restoreRef.current=restore;});
  useEffect(()=>{
    const controller=createProjectAutosaveController({store,delay,restore:archive=>{if(typeof restoreRef.current!=='function')throw new Error('Autosave recovery is not connected to the editor.');return restoreRef.current(archive);}});
    controllerRef.current=controller;
    const unsubscribe=controller.subscribe(setState);
    controller.update(snapshotRef.current);
    void controller.initialize();
    return()=>{unsubscribe();controller.dispose();if(controllerRef.current===controller)controllerRef.current=null;};
  },[store,delay]);
  useEffect(()=>{controllerRef.current?.update(snapshotRef.current);},[fingerprint]);
  const restoreRecovery=useCallback(()=>controllerRef.current?.restoreRecovery(),[]);
  const discardRecovery=useCallback(()=>controllerRef.current?.discardRecovery(),[]);
  const retry=useCallback(()=>controllerRef.current?.retry(),[]);
  return {...state,restoreRecovery,discardRecovery,retry};
}
