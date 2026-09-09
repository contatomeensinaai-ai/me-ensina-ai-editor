const modes = new Set(['nanovsr-644k', 'smart-denoise-drunet', 'remaster-drunet-full', 'migan-256-webgpu']);
const transient = new Set(['src', 'blob', 'url', 'previewUrl', 'trackFrames', 'peaks', 'cutoutVisual']);
function metadata(value) {
  if (value instanceof Blob || typeof value === 'function') return undefined;
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(metadata);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !transient.has(key)).map(([key, item]) => [key, metadata(item)]).filter(([, item]) => item !== undefined));
}
function isApplied(value) { return modes.has(value?.mode) && value.original && value.processed; }
function mediaId(id, key, role) { return `restoration:${encodeURIComponent(id)}:${key}:${role}`; }

/** A frame-only experiment is not an applied media replacement. Persist only
 * completed, reversible pairs, with file references instead of object URLs. */
export function serializeVisualSegment(segment) {
  const result = Object.fromEntries(Object.entries(segment).filter(([key]) => !transient.has(key) && !['enhancement', 'repair'].includes(key)));
  for (const key of ['enhancement', 'repair']) {
    if (!isApplied(segment[key])) continue;
    result[key] = metadata(segment[key]);
    for (const role of ['original', 'processed']) result[key][role].archiveMediaId = mediaId(segment.id, key, role);
  }
  return result;
}
export function serializeProjectVisuals(project) {
  return {...project,
    ...(Array.isArray(project.visualSegments) ? {visualSegments: project.visualSegments.map(serializeVisualSegment)} : {}),
    ...(Array.isArray(project.visualOverlaySegments) ? {visualOverlaySegments: project.visualOverlaySegments.map(serializeVisualSegment)} : {}),
  };
}
/** Auxiliary binaries share the existing visual media manifest; they never
 * become timeline clips. Their deterministic IDs are checked for collision. */
export function expandRestorationMedia(segments) {
  const result = [...segments];
  for (const segment of segments) for (const key of ['enhancement', 'repair']) {
    if (!isApplied(segment[key])) continue;
    for (const role of ['original', 'processed']) {
      const source = segment[key][role];
      if (!(source.blob instanceof Blob) && !source.src) throw new Error('Missing restoration media.');
      result.push({...source, id: mediaId(segment.id, key, role), type: segment.type, name: `${segment.name || 'visual'}-${key}-${role}`});
    }
  }
  if (new Set(result.map(item => item.id)).size !== result.length) throw new Error('Duplicate restoration media identifier.');
  return result;
}
export function restorationReferences(segment) {
  const result = [];
  for (const key of ['enhancement', 'repair']) {
    const record = segment[key];
    // Old archives did not store the alternate binaries. Do not trust their
    // stale blob: URLs. New manifests declaring a pair must contain both.
    if (!record?.original?.archiveMediaId && !record?.processed?.archiveMediaId) continue;
    if (!isApplied(record) || (record.enabled !== undefined && typeof record.enabled !== 'boolean')) throw new Error('Invalid restoration metadata.');
    for (const role of ['original', 'processed']) {
      const source = record[role];
      if (typeof source.archiveMediaId !== 'string' || !source.archiveMediaId) throw new Error('Missing restoration media reference.');
      for (const field of ['width', 'height', 'sourceStart', 'sourceDuration']) if (source[field] !== undefined && (!Number.isFinite(source[field]) || source[field] < 0)) throw new Error('Invalid restoration media geometry.');
      result.push({key, role, source});
    }
  }
  return result;
}
export function hydrateVisualRestorations(segment, visualMedia, allocate) {
  const result = {...segment};
  delete result.enhancement; delete result.repair;
  for (const {key, role, source} of restorationReferences(segment)) {
    const media = visualMedia.get(source.archiveMediaId);
    if (!(media?.blob instanceof Blob)) throw new Error('Missing restoration media.');
    result[key] ??= {...metadata(segment[key])};
    result[key][role] = {...metadata(source), blob: media.blob, src: allocate(media.blob), trackFrames: []};
  }
  return result;
}
