import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { normalizeTrackLocks, normalizeTrackVisibility } from "./projectTrackState.js";
import { normalizeTimelineMarkers } from "./timelineMarkers.js";
import { expandRestorationMedia, serializeProjectVisuals, restorationReferences } from "./restorationMedia.js";

export const PROJECT_ARCHIVE_FORMAT = "timeline-studio-archive";
export const PROJECT_ARCHIVE_VERSION = 3;
const PROJECT_FILE = "project.json";

// Versions 1–3 share this envelope. Optional fields retain their legacy defaults.
// Extension fields remain supported, but must be finite, bounded JSON data.
function invalidProject(path) { throw new Error(`Invalid project data: ${path}`); }
function record(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.prototype.toString.call(value) !== "[object Object]") invalidProject(path);
}
function jsonData(value, path = "project", budget = { nodes: 0 }, depth = 0) {
  if (++budget.nodes > 250000 || depth > 40) invalidProject(`${path} exceeds limits`);
  if (value == null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") { if (!Number.isFinite(value)) invalidProject(path); return; }
  if (typeof value !== "object") invalidProject(path);
  if (!Array.isArray(value)) record(value, path);
  for (const [key, item] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) invalidProject(path);
    jsonData(item, `${path}.${key}`, budget, depth + 1);
  }
}
function fields(value, names, type, path) {
  for (const key of names) if (value[key] !== undefined && typeof value[key] !== type) invalidProject(`${path}.${key}`);
}
function list(value, path, validate) {
  if (!Array.isArray(value) || value.length > 10000) invalidProject(path);
  const ids = new Set();
  value.forEach((item, index) => {
    const location = `${path}[${index}]`; record(item, location);
    if (typeof item.id !== "string" || !item.id.trim() || ids.has(item.id)) invalidProject(`${location}.id`);
    ids.add(item.id); validate?.(item, location);
  });
}
function style(value, path) {
  record(value, path);
  fields(value, ["fontId", "textColor", "backgroundColor", "borderColor", "effect", "textStrokeColor"], "string", path);
  fields(value, ["captionSize", "backgroundOpacity", "borderWidth", "radius", "paddingX", "paddingY", "shadowOpacity", "textStrokeWidth"], "number", path);
}
function placement(value, path) { record(value, path); fields(value, ["x", "y"], "number", path); }
function segment(value, path) {
  fields(value, ["name", "type", "fontId", "text", "src", "url", "assetId", "archiveMediaId", "audioSegmentId", "detachedAudioSegmentId", "highlightColor"], "string", path);
  fields(value, ["hidden", "reversed", "linked"], "boolean", path);
  fields(value, ["start", "end", "duration", "sourceStart", "sourceDuration", "playbackRate", "volume", "fadeIn", "fadeOut", "width", "height"], "number", path);
  for (const key of ["start", "end", "duration", "sourceStart", "sourceDuration", "fadeIn", "fadeOut"]) if (value[key] < 0) invalidProject(`${path}.${key}`);
  if (value.end !== undefined && value.start !== undefined && value.end < value.start) invalidProject(`${path}.end`);
  if (value.playbackRate !== undefined && value.playbackRate <= 0) invalidProject(`${path}.playbackRate`);
  for (const key of ["placement", "baseTransform"]) if (value[key] !== undefined) placement(value[key], `${path}.${key}`);
  if (value.styleOverrides !== undefined) style(value.styleOverrides, `${path}.styleOverrides`);
  for (const key of ["keyframes", "words"]) if (value[key] !== undefined) {
    if (!Array.isArray(value[key])) invalidProject(`${path}.${key}`);
    value[key].forEach((item, index) => { record(item, `${path}.${key}[${index}]`); fields(item, ["time", "start", "end"], "number", path); if (key === "words" && typeof item.text !== "string") invalidProject(`${path}.words`); });
  }
  if (value.highlightWords !== undefined && (!Array.isArray(value.highlightWords) || value.highlightWords.some(word => typeof word !== "string"))) invalidProject(`${path}.highlightWords`);
}

export function validateProjectData(project) {
  record(project, "project"); jsonData(project);
  fields(project, ["script", "selectedVoiceId", "ratioId", "fitMode", "captionPosition", "captionStylePresetId", "selectedFilterId", "selectedTransitionId", "selectedStickerId", "musicName", "sourceAudioName", "sourceAudioAssetId", "sourceAudioSpatialEffect"], "string", "project");
  fields(project, ["speed", "volume", "captionSize", "timelineZoom", "audioDuration", "musicDuration", "musicVolume", "sourceAudioDuration", "sourceAudioStart", "sourceAudioVolume", "sourceAudioSpatialAmount", "musicStart"], "number", "project");
  fields(project, ["captionsEnabled", "sourceAudioLinked"], "boolean", "project");
  for (const key of ["captionSegments", "visualSegments", "visualOverlaySegments", "audioSegments", "musicSegments", "stickerSegments", "timelineMarkers"]) if (project[key] !== undefined) {
    list(project[key], `project.${key}`, (item, path) => { segment(item, path); if (key === "captionSegments" && typeof item.text !== "string") invalidProject(`${path}.text`); });
  }
  if (project.captionStyle !== undefined) style(project.captionStyle, "project.captionStyle");
  if (project.captionPlacement !== undefined) placement(project.captionPlacement, "project.captionPlacement");
  if (project.captionStylePresets !== undefined) list(project.captionStylePresets, "project.captionStylePresets", (preset, path) => {
    fields(preset, ["name"], "string", path); if (preset.style !== undefined) style(preset.style, `${path}.style`);
  });
  for (const key of ["trackVisibility", "trackLocks"]) if (project[key] !== undefined) {
    record(project[key], key); for (const value of Object.values(project[key])) if (typeof value !== "boolean") invalidProject(key);
  }
  if (project.commandState !== undefined) {
    record(project.commandState, "commandState"); fields(project.commandState, ["schemaVersion", "revision"], "number", "commandState");
    if (project.commandState.appliedOperationIds !== undefined && (!Array.isArray(project.commandState.appliedOperationIds) || project.commandState.appliedOperationIds.some(id => typeof id !== "string"))) invalidProject("commandState.appliedOperationIds");
  }
  return project;
}

function requireMedia(blob, entry, label) {
  if (!(blob instanceof Blob) || !blob.size) throw new Error(`Missing project media: ${label}`);
  if (entry?.size !== undefined && (!Number.isSafeInteger(entry.size) || entry.size !== blob.size)) throw new Error(`Project media size mismatch: ${label}`);
}

/** Validate both ZIP imports and the archive-like output of IndexedDB recovery. */
export function validateProjectArchive(archive) {
  record(archive?.payload, "payload"); const payload = archive.payload;
  if (payload.format !== undefined && payload.format !== (archive.legacy ? "timeline-studio-project" : PROJECT_ARCHIVE_FORMAT)) invalidProject("format");
  if (!archive.legacy && payload.version !== undefined && ![1, 2, 3].includes(payload.version)) invalidProject("version");
  const data = validateProjectData(payload.project);
  const media = payload.media || {}; record(media, "media");
  for (const [key, map] of [["visuals", archive.visualMedia], ["audioSegments", archive.audioSegmentMedia]]) {
    if (media[key] !== undefined) list(media[key], `media.${key}`, (entry) => requireMedia(map?.get(entry.id)?.blob, entry, entry.id));
    if (map !== undefined && !(map instanceof Map)) invalidProject(`media.${key}`);
    for (const [id, entry] of map || []) { record(entry, `media.${key}.${id}`); requireMedia(entry.blob, entry, id); }
  }
  for (const key of ["audio", "sourceAudio", "music"]) {
    if (media[key] != null) record(media[key], `media.${key}`);
    if (media[key] != null || archive[key] != null) requireMedia(archive[key], media[key], key);
  }
  if (!archive.legacy) {
    for (const item of [...(data.visualSegments || []), ...(data.visualOverlaySegments || [])]) {
      requireMedia(resolveProjectVisualMedia(archive.visualMedia || new Map(), item)?.blob, null, item.id);
      for (const {source} of restorationReferences(item)) requireMedia(archive.visualMedia?.get(source.archiveMediaId)?.blob, null, source.archiveMediaId);
    }
    for (const item of data.audioSegments || []) requireMedia(archive.audioSegmentMedia?.get(item.id)?.blob || archive.audio, null, item.id);
    if (data.audioDuration > 0 && !data.audioSegments?.length) requireMedia(archive.audio, null, "audio");
    if (data.sourceAudioDuration > 0) requireMedia(archive.sourceAudio, null, "sourceAudio");
    if (data.musicDuration > 0 || data.musicSegments?.length) requireMedia(archive.music, null, "music");
  }
  return archive;
}

export function resolveProjectVisualMedia(visualMedia, segment) {
  return visualMedia.get(segment?.id) || visualMedia.get(segment?.archiveMediaId) || visualMedia.get(segment?.assetId) || null;
}

function readWithFileReader(file, mode) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("无法读取工程文件"));
    reader.onload = () => resolve(reader.result);
    if (mode === "text") reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

export async function readProjectFileAsText(file) {
  return typeof file?.text === "function" ? file.text() : readWithFileReader(file, "text");
}

async function readProjectFileAsArrayBuffer(file) {
  return typeof file?.arrayBuffer === "function" ? file.arrayBuffer() : readWithFileReader(file, "arrayBuffer");
}

function extensionFor(blob, fallback = "bin") {
  const type = blob?.type || "";
  const known = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm",
  };
  return known[type] || fallback;
}

function safeName(name, fallback) {
  return String(name || fallback).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 96) || fallback;
}

async function blobForSource(source, blob) {
  if (blob instanceof Blob) return blob;
  if (!source) return null;
  const response = await fetch(source);
  if (!response.ok) throw new Error("无法读取媒体素材");
  return response.blob();
}

/** Create a portable .timeline archive with media binaries and project metadata. */
export async function createProjectArchive({ project, visualSegments = [], audioSegments = [], audio, sourceAudio, music }) {
  const files = {};
  const media = { visuals: [], audioSegments: [], audio: null, sourceAudio: null, music: null };
  visualSegments = expandRestorationMedia(visualSegments);
  const visualPaths = new WeakMap();

  for (let index = 0; index < visualSegments.length; index += 1) {
    const segment = visualSegments[index];
    if (!segment?.src && !segment?.blob) continue;
    const blob = await blobForSource(segment.src, segment.blob);
    if (!blob) continue;
    const path = visualPaths.get(blob) || `media/visuals/${String(index + 1).padStart(3, "0")}-${safeName(segment.name, "visual")}.${extensionFor(blob, segment.type === "video" ? "mp4" : "png")}`;
    if (!visualPaths.has(blob)) files[path] = new Uint8Array(await blob.arrayBuffer());
    visualPaths.set(blob, path);
    media.visuals.push({ id: segment.id, path, name: segment.name || "素材", type: blob.type, size: blob.size });
  }

  for (let index = 0; index < audioSegments.length; index += 1) {
    const segment = audioSegments[index];
    const blob = await blobForSource(segment?.url, segment?.blob);
    if (!segment?.id || !blob) continue;
    const path = `media/audio/voice-${String(index + 1).padStart(3, "0")}-${safeName(segment.name, "voiceover")}.${extensionFor(blob, "wav")}`;
    files[path] = new Uint8Array(await blob.arrayBuffer());
    media.audioSegments.push({ id: segment.id, path, name: segment.name || "配音", type: blob.type, size: blob.size });
  }

  for (const [key, track] of Object.entries({ audio, sourceAudio, music })) {
    if (key === "audio" && media.audioSegments.length) continue;
    if (!(track?.blob instanceof Blob)) continue;
    const path = `media/audio/${key}-${safeName(track.name, key)}.${extensionFor(track.blob, "webm")}`;
    files[path] = new Uint8Array(await track.blob.arrayBuffer());
    media[key] = { path, name: track.name || key, type: track.blob.type, size: track.blob.size };
  }

  const normalizedProject = {
    ...serializeProjectVisuals(project),
    timelineMarkers: normalizeTimelineMarkers(project?.timelineMarkers),
    trackVisibility: normalizeTrackVisibility(project?.trackVisibility),
    trackLocks: normalizeTrackLocks(project?.trackLocks),
  };
  const payload = {
    format: PROJECT_ARCHIVE_FORMAT,
    version: PROJECT_ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    project: normalizedProject,
    media,
  };
  files[PROJECT_FILE] = strToU8(JSON.stringify(payload));
  return new Blob([zipSync(files, { level: 6 })], { type: "application/zip" });
}

/** Read and validate a portable project archive. Returns metadata plus media Blobs. */
export async function readProjectArchive(file) {
  const files = unzipSync(new Uint8Array(await readProjectFileAsArrayBuffer(file)));
  if (!files[PROJECT_FILE]) throw new Error("缺少 project.json");
  const payload = JSON.parse(strFromU8(files[PROJECT_FILE]));
  if (payload?.format !== PROJECT_ARCHIVE_FORMAT || ![1, 2, 3].includes(payload.version)) throw new Error("Invalid project archive format/version");
  validateProjectData(payload.project);
  const media = payload.media || {}; record(media, "media");
  for (const key of ["visuals", "audioSegments"]) if (media[key] !== undefined) list(media[key], `media.${key}`);
  const getBlob = (entry) => {
    if (entry == null) return null;
    record(entry, "media entry");
    if (typeof entry.path !== "string" || !entry.path.startsWith("media/") || entry.path.split("/").includes("..") || !files[entry.path]?.length) throw new Error("Missing project media binary");
    if (entry.type !== undefined && typeof entry.type !== "string") invalidProject("media.type");
    const blob = new Blob([files[entry.path]], { type: entry.type || "application/octet-stream" });
    requireMedia(blob, entry, entry.path);
    return blob;
  };
  const archive = {
    payload,
    visualMedia: new Map((media.visuals || []).map((entry) => [entry.id, { ...entry, blob: getBlob(entry) }])),
    audioSegmentMedia: new Map((media.audioSegments || []).map((entry) => [entry.id, { ...entry, blob: getBlob(entry) }])),
    audio: getBlob(media.audio), sourceAudio: getBlob(media.sourceAudio), music: getBlob(media.music),
  };
  validateProjectArchive(archive);
  payload.project = { ...payload.project, timelineMarkers: normalizeTimelineMarkers(payload.project.timelineMarkers) };
  return archive;
}
