import {expandRestorationMedia, serializeProjectVisuals} from './restorationMedia.js';
/** Local checkpoint format. Media lives in a separate store, never in a ZIP. */
export const PROJECT_CHECKPOINT_VERSION = 1;
// Version 2 fences clients using the old unconditional-write protocol. Existing
// connections close on versionchange; an old client opening version 1 fails.
export const PROJECT_CHECKPOINT_DATABASE_VERSION = 2;
export const PROJECT_CHECKPOINT_DATABASE = 'timeline-studio-project-checkpoints';
export const PROJECT_CHECKPOINT_CONFLICT = 'PROJECT_CHECKPOINT_CONFLICT';
const CHECKPOINT_KEY = 'latest';
const blobIds = new WeakMap();
const sourceIds = new Map();
const transientKeys = new Set(['blob', 'src', 'url', 'previewUrl', 'trackFrames', 'peaks', 'cutoutVisual']);
const viewKeys = new Set(['currentTime', 'playhead', 'playheadTime', 'timelineZoom', 'timelineHorizon', 'viewport', 'scrollLeft', 'scrollTop']);

/** A legacy read is non-mutating. Its exact stored metadata is its initial token;
 * the first successful CAS replaces that token with a new opaque UUID. */
export function getProjectCheckpointRevision(checkpoint) {
  if (!checkpoint) return null;
  if (Object.hasOwn(checkpoint, 'revision')) {
    if (typeof checkpoint.revision !== 'string' || !checkpoint.revision) throw new Error('Damaged autosave revision.');
    return checkpoint.revision;
  }
  const {version,savedAt,fingerprint,snapshot,mediaIds} = checkpoint;
  return `legacy:${JSON.stringify({version,savedAt,fingerprint,snapshot,mediaIds})}`;
}

function checkpointConflict() {
  return Object.assign(new Error('Outro editor alterou o salvamento automático. Exporte seu projeto antes de recarregar e revisar a recuperação; tentar novamente não substituirá a outra versão.'), {code:PROJECT_CHECKPOINT_CONFLICT});
}

function blobId(blob) {
  if (!blobIds.has(blob)) blobIds.set(blob, globalThis.crypto.randomUUID());
  return blobIds.get(blob);
}
function sourceId(source) {
  if (!sourceIds.has(source)) sourceIds.set(source, globalThis.crypto.randomUUID());
  return sourceIds.get(source);
}
function clean(value, fingerprint = false, depth = 0) {
  if (value == null || typeof value !== 'object') return typeof value === 'function' ? undefined : value;
  if (value instanceof Blob) return fingerprint ? {mediaId:blobId(value),size:value.size,type:value.type} : undefined;
  if (Array.isArray(value)) return value.map(item => clean(item, fingerprint, depth + 1));
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if ((depth <= 1 && viewKeys.has(key)) || transientKeys.has(key)) continue;
    const next = clean(value[key], fingerprint, depth + 1);
    if (next !== undefined) result[key] = next;
  }
  if (fingerprint && value.blob instanceof Blob) result.$media = clean(value.blob, true);
  else if (fingerprint && (value.src || value.url)) result.$media = {sourceId:sourceId(value.src || value.url)};
  return result;
}

/** Stable for object key order, Blob identity and editing data; excludes UI state. */
export function projectSnapshotFingerprint(snapshot) {
  return JSON.stringify(clean(snapshot, true));
}

async function fetchLocalBlob(source) {
  const url = new URL(source, globalThis.location?.href);
  if (!['blob:', 'data:'].includes(url.protocol) && url.origin !== globalThis.location?.origin) {
    throw new Error('Autosave requires locally imported media.');
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Autosave could not read media.');
  return response.blob();
}

export async function prepareProjectCheckpoint(snapshot, {fetchBlob = fetchLocalBlob} = {}) {
  if (!snapshot?.project || typeof snapshot.project !== 'object') throw new Error('Invalid project checkpoint.');
  const project = clean(serializeProjectVisuals(snapshot.project));
  const blobs = new Map();
  const sources = new Map();
  async function capture(track) {
    if (!track) return null;
    let blob = track.blob;
    const source = track.src || track.url;
    if (!(blob instanceof Blob) && source) {
      if (!sources.has(source)) sources.set(source, fetchBlob(source));
      blob = await sources.get(source);
      if (blob instanceof Blob) blobIds.set(blob, sourceId(source));
    }
    if (!(blob instanceof Blob)) throw new Error('Autosave is missing media for an existing track.');
    const mediaId = blobId(blob);
    blobs.set(mediaId, blob);
    return {...clean(track), mediaId, type:blob.type, size:blob.size};
  }
  const visuals = [];
  for (const track of expandRestorationMedia(snapshot.visualSegments || [])) visuals.push(await capture(track));
  const audioSegments = [];
  for (const track of snapshot.audioSegments || []) audioSegments.push(await capture(track));
  const audio = await capture(snapshot.audio);
  const sourceAudio = await capture(snapshot.sourceAudio);
  const music = await capture(snapshot.music);
  return {
    version: PROJECT_CHECKPOINT_VERSION,
    savedAt: new Date().toISOString(),
    fingerprint: projectSnapshotFingerprint(snapshot),
    snapshot:{project,visualSegments:visuals,audioSegments,audio,sourceAudio,music},
    mediaIds:[...blobs.keys()], blobs,
  };
}

function validateCheckpoint(checkpoint) {
  if (checkpoint?.version !== PROJECT_CHECKPOINT_VERSION || !checkpoint.snapshot?.project || !Array.isArray(checkpoint.mediaIds)) {
    throw new Error('Unsupported or damaged autosave checkpoint.');
  }
  const state=checkpoint.snapshot;
  if(!Array.isArray(state.visualSegments)||!Array.isArray(state.audioSegments))throw new Error('Unsupported or damaged autosave checkpoint.');
  const entries=[...state.visualSegments,...state.audioSegments,state.audio,state.sourceAudio,state.music].filter(Boolean);
  for(const entry of entries)if(!checkpoint.mediaIds.includes(entry.mediaId)||!(checkpoint.blobs?.get(entry.mediaId) instanceof Blob))throw new Error('Autosave media is missing.');
  for (const id of checkpoint.mediaIds) {
    if (!(checkpoint.blobs?.get(id) instanceof Blob)) throw new Error('Autosave media is missing.');
  }
}

/** Direct input to the same hydrate routine used by readProjectArchive. */
export function checkpointToArchive(checkpoint) {
  validateCheckpoint(checkpoint);
  const state = checkpoint.snapshot;
  const blobFor = entry => entry ? checkpoint.blobs.get(entry.mediaId) : null;
  const asMap = entries => new Map((entries || []).map(entry => [entry.id, {...entry,blob:blobFor(entry)}]));
  return {
    payload:{format:'timeline-studio-archive',version:3,project:state.project,media:{visuals:state.visualSegments,audioSegments:state.audioSegments,audio:state.audio,sourceAudio:state.sourceAudio,music:state.music}},
    visualMedia:asMap(state.visualSegments), audioSegmentMedia:asMap(state.audioSegments),
    audio:blobFor(state.audio),sourceAudio:blobFor(state.sourceAudio),music:blobFor(state.music),
  };
}

export function openProjectCheckpointDatabase(indexedDB = globalThis.indexedDB) {
  return new Promise((resolve,reject) => {
    if (!indexedDB) { reject(new Error('IndexedDB is unavailable; the project has not been saved.')); return; }
    const request = indexedDB.open(PROJECT_CHECKPOINT_DATABASE, PROJECT_CHECKPOINT_DATABASE_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('checkpoints')) db.createObjectStore('checkpoints');
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
    };
    request.onerror = () => reject(request.error || new Error('Could not open autosave storage.'));
    request.onblocked = () => { blocked=true; reject(new Error('Autosave storage is blocked by another tab.')); };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

/** Each caller supplies the revision it reviewed. CAS, metadata and media changes
 * share one IDB transaction, so independent tabs cannot both win the comparison. */
export function createProjectCheckpointStore({openDatabase = openProjectCheckpointDatabase, fetchBlob} = {}) {
  let queue = Promise.resolve();
  async function saveNow(snapshot, expectedRevision) {
    if (expectedRevision !== null && (typeof expectedRevision !== 'string' || !expectedRevision)) throw new TypeError('Expected autosave revision must be a token or null.');
    // Resolve media before opening a transaction (awaiting fetch inside IDB makes it inactive).
    const checkpoint = await prepareProjectCheckpoint(snapshot, {fetchBlob});
    const db = await openDatabase();
    try {
      await new Promise((resolve,reject) => {
        const tx = db.transaction(['checkpoints','media'], 'readwrite');
        let failure;
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(failure || tx.error || new Error('Autosave transaction aborted.'));
        tx.onerror = () => { failure ||= tx.error; };
        const request = tx.objectStore('checkpoints').get(CHECKPOINT_KEY);
        request.onsuccess = () => {
          try {
            if (getProjectCheckpointRevision(request.result) !== expectedRevision) throw checkpointConflict();
            checkpoint.revision = globalThis.crypto.randomUUID();
            const previousIds = new Set(request.result?.mediaIds || []);
            const nextIds = new Set(checkpoint.mediaIds);
            const mediaStore = tx.objectStore('media');
            for (const [id,blob] of checkpoint.blobs) if (!previousIds.has(id)) mediaStore.put(blob,id);
            for (const id of previousIds) if (!nextIds.has(id)) mediaStore.delete(id);
            const {blobs:_blobs,...metadata} = checkpoint;
            tx.objectStore('checkpoints').put(metadata,CHECKPOINT_KEY);
          } catch (error) { failure=error; tx.abort(); }
        };
      });
      return checkpoint;
    } finally { db.close(); }
  }
  return {
    // Omission is create-only, never an implicit read-and-overwrite.
    save(snapshot, {expectedRevision = null} = {}) {
      const result = queue.then(() => saveNow(snapshot, expectedRevision));
      queue = result.catch(() => {});
      return result;
    },
    async load() {
      await queue;
      const db = await openDatabase();
      try {
        return await new Promise((resolve,reject) => {
          const tx = db.transaction(['checkpoints','media'],'readonly');
          let checkpoint = null;
          let failure;
          tx.onabort = () => reject(failure || tx.error || new Error('Autosave recovery failed.'));
          tx.onerror = () => { failure ||= tx.error; };
          tx.oncomplete = () => {
            try {
              if (checkpoint) {
                validateCheckpoint(checkpoint);
                checkpoint.revision = getProjectCheckpointRevision(checkpoint);
              }
              resolve(checkpoint);
            }
            catch (error) { reject(error); }
          };
          const request = tx.objectStore('checkpoints').get(CHECKPOINT_KEY);
          request.onsuccess = () => {
            if (!request.result) return;
            checkpoint = {...request.result,blobs:new Map()};
            if (!Array.isArray(checkpoint.mediaIds)) { failure=new Error('Damaged autosave checkpoint.');tx.abort();return; }
            for (const id of checkpoint.mediaIds) {
              const media = tx.objectStore('media').get(id);
              media.onsuccess = () => {
                if (media.result instanceof Blob) { checkpoint.blobs.set(id,media.result);blobIds.set(media.result,id); }
              };
            }
          };
        });
      } finally { db.close(); }
    },
  };
}

export const projectCheckpointStore = createProjectCheckpointStore();
export const saveProjectCheckpoint = (snapshot, options) => projectCheckpointStore.save(snapshot, options);
export const loadProjectCheckpoint = () => projectCheckpointStore.load();
