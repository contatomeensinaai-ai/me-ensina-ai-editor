import { getCaptionTimeline, getVisualSegmentTimeline } from './timeline.js';
import { createVisualOverlaySegment } from './visualOverlayTimeline.js';

export const SUPPORTING_IMAGE_LIMIT = 24;
const fail = (key) => { throw new Error(key); };
const number = (value) => typeof value === 'number' && Number.isFinite(value);
const ratio = (value) => number(value) && value >= 0.2 && value <= 0.65;
const position = (value = { x: 0.5, y: 0.5 }) => {
  if (!number(value?.x) || !number(value?.y) || value.x < 0 || value.x > 1 || value.y < 0 || value.y > 1) fail('supportingInvalidPosition');
  return { x: value.x, y: value.y };
};

// Exact deterministic snapshot, not a security token. Blob bytes stay local and are never serialized.
export function createSupportingSnapshot({ captionSegments = [], visualSegments = [], visualOverlaySegments = [], timelineDuration = 0 } = {}) {
  return JSON.stringify({ captionSegments, visualSegments, visualOverlaySegments, timelineDuration }, (key, value) => {
    if (key === 'blob' || key === 'trackFrames' || key === 'peaks') return undefined;
    return value;
  });
}

export function validateSupportingPlan(input, context) {
  let plan = input;
  if (typeof plan === 'string') {
    try { plan = JSON.parse(plan); } catch { fail('supportingInvalidJson'); }
  }
  if (!plan || plan.version !== 1 || !Array.isArray(plan.items) || !plan.items.length || plan.items.length > SUPPORTING_IMAGE_LIMIT) fail('supportingInvalidPlan');
  if (plan.snapshot !== createSupportingSnapshot(context)) fail('supportingStale');
  const captions = new Map((context.captionSegments || []).map((item) => [item.id, item]));
  const assets = new Map((context.assets || []).map((item) => [item.id, item]));
  const visualTimeline = getVisualSegmentTimeline(context.visualSegments || []);
  if (!number(context.timelineDuration) || context.timelineDuration <= 0) fail('supportingInvalidTime');
  const items = plan.items.map((item) => {
    if (!item || !captions.has(item.captionId)) fail('supportingUnknownCaption');
    const asset = assets.get(item.assetId);
    if (!asset || asset.type !== 'image' || !asset.src || !asset.blob) fail('supportingUnknownImage');
    if (!number(item.start) || !number(item.end) || item.start < 0 || item.end <= item.start || item.end > context.timelineDuration) fail('supportingInvalidTime');
    if (!ratio(item.topRatio)) fail('supportingInvalidRatio');
    // The plan must cover at least one existing base visual; a top image alone is not this composition.
    const intersects = visualTimeline.some((segment) => segment.start <= item.start && segment.end > item.start) && item.end <= (visualTimeline.at(-1)?.end || 0);
    if (!intersects) fail('supportingNoVideo');
    return { captionId: item.captionId, assetId: item.assetId, start: item.start, end: item.end, topRatio: item.topRatio,
      videoPosition: position(item.videoPosition), imagePosition: position(item.imagePosition) };
  }).sort((a, b) => a.start - b.start);
  if (items.some((item, index) => index > 0 && item.start < items[index - 1].end)) fail('supportingOverlap');
  return { version: 1, snapshot: plan.snapshot, items };
}

export function applySupportingPlan(plan, context) {
  const reviewed = validateSupportingPlan(plan, context);
  const { visualSegments = [], visualOverlaySegments = [], assets = [] } = context;
  const visualTimeline = getVisualSegmentTimeline(visualSegments);
  const retained = visualOverlaySegments.filter((overlay) => overlay.supportingLayout?.role !== 'image');
  const firstLayer = retained.reduce((max, item) => Math.max(max, item.layer || 1), 0) + 1;
  const overlays = reviewed.items.map((item) => ({
    ...createVisualOverlaySegment(assets.find((asset) => asset.id === item.assetId), item.start,
      { duration: item.end - item.start, layer: firstLayer, baseTransform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } }),
    supportingLayout: { version: 1, role: 'image', captionId: item.captionId, topRatio: item.topRatio, imagePosition: item.imagePosition, fit: 'contain' },
  }));
  return {
    visualSegments: visualSegments.map((segment, index) => {
      const range = visualTimeline[index];
      const windows = reviewed.items.filter((item) => range.start < item.end && range.end > item.start)
        .map(({ start, end, topRatio, videoPosition }) => ({ start, end, topRatio, videoPosition, fit: 'contain' }));
      const { supportingLayout: _previous, ...base } = segment;
      return windows.length ? { ...base, supportingLayout: { version: 1, windows } } : base;
    }),
    visualOverlaySegments: [...retained, ...overlays],
    undo: { visualSegments, visualOverlaySegments },
    appliedAssetIds: reviewed.items.map((item) => item.assetId),
  };
}

export function getSupportingLayoutAtTime(segment, time) {
  if (segment?.supportingLayout?.version !== 1 || !number(time)) return null;
  return segment.supportingLayout.windows?.find((window) => time >= window.start && time < window.end) || null;
}

export function getSupportingGeometry(layout, width, height) {
  if (!ratio(layout?.topRatio) || !number(width) || !number(height) || width <= 0 || height <= 0) fail('supportingInvalidRatio');
  const split = height * layout.topRatio;
  return { image: { x: 0, y: 0, width, height: split }, video: { x: 0, y: split, width, height: height - split } };
}

export function createSupportingDraft(context, assets, topRatio = 0.4) {
  const captionTimeline = getCaptionTimeline(context.captionSegments || [], context.timelineDuration);
  return { version: 1, snapshot: createSupportingSnapshot(context), items: assets.slice(0, SUPPORTING_IMAGE_LIMIT).map((asset, index) => {
    const caption = context.captionSegments?.[index];
    return caption ? { assetId: asset.id, captionId: caption.id, start: captionTimeline[index].start, end: captionTimeline[index].end, topRatio,
      videoPosition: { x: 0.5, y: 0.5 }, imagePosition: { x: 0.5, y: 0.5 } } : null;
  }).filter(Boolean) };
}

export async function importSupportingImage(file) {
  if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file?.type || '') || file.size <= 0 || file.size > 30 * 1024 * 1024) fail('supportingInvalidFile');
  const src = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = src;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) fail('supportingInvalidFile');
    return { id: `supporting-${crypto.randomUUID()}`, name: file.name, type: 'image', src, blob: file, width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    URL.revokeObjectURL(src);
    fail('supportingInvalidFile');
  }
}

// Reopen the existing reviewed arrangement without reassigning images to different captions.
export function restoreSupportingDraft(context) {
  const overlays = (context.visualOverlaySegments || []).filter((overlay) => overlay.supportingLayout?.role === 'image');
  if (!overlays.length) return null;
  const items = overlays.map((overlay) => {
    const layout = overlay.supportingLayout;
    const window = (context.visualSegments || []).flatMap((segment) => segment.supportingLayout?.windows || [])
      .find((entry) => entry.start === overlay.start && entry.end === overlay.start + overlay.duration);
    return { captionId: layout.captionId, assetId: overlay.assetId, start: overlay.start, end: overlay.start + overlay.duration,
      topRatio: layout.topRatio, imagePosition: layout.imagePosition || { x: 0.5, y: 0.5 }, videoPosition: window?.videoPosition || { x: 0.5, y: 0.5 } };
  });
  try { return validateSupportingPlan({ version: 1, snapshot: createSupportingSnapshot(context), items }, context); } catch { return null; }
}

// The same local viewport is used by mask pixels, pointer coordinates and export.
export function getVisualCompositionRegion(segment, frame, time) {
  const full = { x: 0, y: 0, width: Math.max(1, Number(frame?.width) || 1), height: Math.max(1, Number(frame?.height) || 1) };
  const layout = segment?.supportingLayout?.role === 'image' ? segment.supportingLayout : getSupportingLayoutAtTime(segment, time);
  if (!layout) return full;
  return getSupportingGeometry(layout, full.width, full.height)[segment?.supportingLayout?.role === 'image' ? 'image' : 'video'];
}
