import { useEffect, useRef, useState } from 'react';
import { applySupportingPlan, createSupportingDraft, createSupportingSnapshot, restoreSupportingDraft, importSupportingImage, SUPPORTING_IMAGE_LIMIT, validateSupportingPlan } from '../lib/supportingImages.js';
import { getCaptionTimeline, getVisualSegmentTimeline } from '../lib/timeline.js';
import { getVisualSourceTime } from '../lib/visualEffects.js';
import { generateSupportingImage, supportingImageErrorMessage } from '../lib/supportingImageGeneration.js';
import { planSupportingImages } from '../lib/supportingImagePlanning.js';
import './SupportingImagesPanel.css';

export function SupportingImagesPanel({ captionSegments = [], visualSegments = [], visualOverlaySegments = [], timelineDuration = 0, onApply, t, language = 'en', frameAspectRatio = '9/16' }) {
  const [assets, setAssets] = useState(() => [...new Map(visualOverlaySegments.filter((item) => item.supportingLayout?.role === 'image' && item.blob).map((item) => [item.assetId, { ...item, id: item.assetId }])).values()]);
  const [draft, setDraft] = useState(() => restoreSupportingDraft({ captionSegments, visualSegments, visualOverlaySegments, timelineDuration, assets }));
  const [json, setJson] = useState(() => draft ? JSON.stringify(draft, null, 2) : '');
  const [jsonDirty, setJsonDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const planningRequest = useRef(null);
  const latestContext = useRef(null);
  const [importing, setImporting] = useState(false);
  const pendingImport = useRef(false);
  const owned = useRef(new Map());
  const applied = useRef(new Set());
  const active = useRef(true);
  const request = useRef(null);
  const previewVideo = useRef(null);
  const context = { captionSegments, visualSegments, visualOverlaySegments, timelineDuration, assets };
  latestContext.current = context;
  const item = draft?.items[previewIndex] || draft?.items[0];
  const image = assets.find((asset) => asset.id === item?.assetId);
  const visualTimeline = getVisualSegmentTimeline(visualSegments);
  const captionTimeline = getCaptionTimeline(captionSegments, timelineDuration);
  const videoIndex = visualTimeline.findIndex((segment) => item && segment.start <= item.start && segment.end > item.start);
  const video = visualSegments[videoIndex];
  const sourceTime = video && item ? getVisualSourceTime(video, item.start - visualTimeline[videoIndex].start) : 0;
  useEffect(() => {
    active.current = true;
    const urls = owned.current;
    const retained = applied.current;
    return () => {
      active.current = false;
      request.current?.abort();
      planningRequest.current?.abort();
      for (const [id, src] of urls) if (!retained.has(id)) URL.revokeObjectURL(src);
    };
  }, []);
  useEffect(() => {
    if (previewVideo.current?.readyState >= 1) previewVideo.current.currentTime = sourceTime;
  }, [sourceTime, video?.src]);
  const errorStatus = (error) => setStatus(/^supporting[A-Z]/.test(error?.message || '') ? error.message : 'supportingFailed');
  const replaceDraft = (next) => { setDraft(next); setJson(JSON.stringify(next, null, 2)); setJsonDirty(false); };
  const importFiles = async (files) => {
    if (pendingImport.current) return [];
    pendingImport.current = true; setImporting(true);
    const room = SUPPORTING_IMAGE_LIMIT - assets.length;
    const fileCount = files.length;
    const selected = Array.from(files).slice(0, room);
    const results = await Promise.allSettled(selected.map(importSupportingImage));
    const imported = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    pendingImport.current = false;
    if (!active.current) { for (const asset of imported) URL.revokeObjectURL(asset.src); return []; }
    setImporting(false);
    for (const asset of imported) owned.current.set(asset.id, asset.src);
    setAssets((previous) => [...previous, ...imported]);
    setStatus(results.some((result) => result.status === 'rejected') ? 'supportingInvalidFile' : selected.length < fileCount ? 'supportingInvalidPlan' : 'supportingImported');
    return imported;
  };
  const prepare = () => {
    if (!assets.length || !captionSegments.length) { setStatus('supportingEmpty'); return; }
    replaceDraft(createSupportingDraft(context, assets));
    setPreviewIndex(0); setStatus('supportingManualHint');
  };
  const update = (index, patch) => {
    replaceDraft({ ...draft, items: draft.items.map((entry, i) => i === index ? { ...entry, ...patch } : entry) });
    setPreviewIndex(index); setStatus('supportingReady');
  };
  const loadJson = () => { try { replaceDraft(validateSupportingPlan(json, context)); setPreviewIndex(0); setStatus('supportingReady'); } catch (error) { errorStatus(error); } };
  const apply = () => {
    try {
      const result = applySupportingPlan(draft, context);
      onApply(result);
      for (const id of result.appliedAssetIds) applied.current.add(id);
      replaceDraft({ ...draft, snapshot: createSupportingSnapshot({ ...context, visualSegments: result.visualSegments, visualOverlaySegments: result.visualOverlaySegments }) });
      setStatus('supportingApplied');
    } catch (error) { errorStatus(error); }
  };
  const generate = async () => {
    if (request.current || planningRequest.current || !prompt.trim() || assets.length >= SUPPORTING_IMAGE_LIMIT) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setStatus('supportingGenerating');
    try {
      const file = await generateSupportingImage(prompt.trim(), { signal: controller.signal, language });
      if (controller.signal.aborted || !active.current) return;
      const imported = await importFiles([file]);
      if (imported.length && !controller.signal.aborted && active.current) setStatus('supportingGenerated');
    } catch (error) {
      if (active.current) setStatus(controller.signal.aborted ? 'supportingCanceled' : { generationCode: error.code || 'failed' });
    } finally {
      if (request.current === controller) { request.current = null; if (active.current) setBusy(false); }
    }
  };
  const suggest = async () => {
    if (planningRequest.current || request.current || !assets.length || assets.length > 12 || !captionSegments.length) return;
    const controller = new AbortController(); planningRequest.current = controller;
    setPlanning(true); setStatus('supportingPlanning');
    try {
      const plan = await planSupportingImages(context, assets, { signal: controller.signal, language });
      if (!controller.signal.aborted && active.current) {
        replaceDraft(validateSupportingPlan(plan, latestContext.current));
        setPreviewIndex(0); setStatus('supportingReady');
      }
    } catch (error) {
      if (active.current) {
        if (controller.signal.aborted) setStatus('supportingPlanningCanceled');
        else if (/^supporting[A-Z]/.test(error?.message || '')) errorStatus(error);
        else setStatus('supportingPlanningFailed');
      }
    } finally {
      if (planningRequest.current === controller) { planningRequest.current = null; if (active.current) setPlanning(false); }
    }
  };
  const deleteImage = (asset) => {
    setAssets((previous) => previous.filter((entry) => entry.id !== asset.id));
    if (owned.current.has(asset.id) && !applied.current.has(asset.id)) { URL.revokeObjectURL(asset.src); owned.current.delete(asset.id); }
    if (draft) replaceDraft({ ...draft, items: draft.items.filter((entry) => entry.assetId !== asset.id) });
  };
  return <section className="supporting-images-panel" aria-label={t('supportingTitle')}>
    <h3>{t('supportingTitle')}</h3><p>{t('supportingHint')}</p>
    <label>{t('supportingImport')}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" multiple disabled={busy || planning || importing || assets.length >= SUPPORTING_IMAGE_LIMIT} onChange={(event) => { importFiles(event.target.files || []); event.target.value = ''; }} /></label>
    <small>{t('supportingFilesHint')}</small>
    <div className="supporting-image-library">{assets.map((asset) => <figure key={asset.id}>
      <img src={asset.src} alt={asset.name} /><figcaption>{asset.name}</figcaption>
      <button type="button" aria-label={`${t('supportingDeleteImage')}: ${asset.name}`} disabled={planning} onClick={() => deleteImage(asset)}>{t('supportingDeleteImage')}</button>
    </figure>)}</div>
    <label>{t('supportingPrompt')}<textarea rows={3} maxLength={2000} value={prompt} disabled={busy} onChange={(event) => setPrompt(event.target.value)} /></label>
    <small>{t('supportingGenerationHint')}</small>
    <button type="button" disabled={busy || planning || importing || !prompt.trim() || assets.length >= SUPPORTING_IMAGE_LIMIT} onClick={generate}>{t('supportingGenerate')}</button>
    {busy && <button type="button" onClick={() => { request.current?.abort(); setStatus('supportingCanceled'); }}>{t('supportingCancel')}</button>}
    <p role="status" aria-live="polite">{status ? (status.generationCode ? supportingImageErrorMessage(status.generationCode, language) : t(status)) : ''}</p>
    <button type="button" disabled={planning || !assets.length || !captionSegments.length} onClick={prepare}>{t('supportingPrepare')}</button>
    <p>{t('supportingManualHint')}</p>
    <p>{t('supportingPlanningHint')}</p>
    <button type="button" disabled={busy || planning || importing || !assets.length || assets.length > 12 || !captionSegments.length} onClick={suggest}>{t('supportingSuggest')}</button>
    {planning && <button type="button" onClick={() => { planningRequest.current?.abort(); setStatus('supportingPlanningCanceled'); }}>{t('supportingPlanningCancel')}</button>}
    {draft?.items.map((entry, index) => <fieldset disabled={planning} key={`${entry.assetId}-${index}`}>
      <legend>{index + 1}</legend>
      <label>{t('supportingImage')}<select value={entry.assetId} onChange={(event) => update(index, { assetId: event.target.value })}>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.name}</option>)}</select></label>
      <label>{t('supportingCaption')}<select value={entry.captionId} onChange={(event) => {
        const captionIndex = captionSegments.findIndex((segment) => segment.id === event.target.value);
        const caption = captionSegments[captionIndex];
        if (caption) update(index, { captionId: caption.id, start: captionTimeline[captionIndex].start, end: captionTimeline[captionIndex].end });
      }}>{captionSegments.map((caption) => <option value={caption.id} key={caption.id}>{caption.text}</option>)}</select></label>
      <div className="supporting-time-fields">{['start', 'end'].map((field) => <label key={field}>{t(field === 'start' ? 'supportingStart' : 'supportingEnd')}<input type="number" aria-label={t(field === 'start' ? 'supportingStart' : 'supportingEnd')} min="0" max={timelineDuration} step="0.01" value={entry[field]} onChange={(event) => update(index, { [field]: event.target.value === '' ? '' : Number(event.target.value) })} /></label>)}</div>
      <label>{t('supportingRatio')} ({Math.round(entry.topRatio * 100)}%)<input type="range" min="20" max="65" value={entry.topRatio * 100} onChange={(event) => update(index, { topRatio: Number(event.target.value) / 100 })} /></label>
      {['x', 'y'].map((axis) => <label key={axis}>{t(axis === 'x' ? 'supportingVideoX' : 'supportingVideoY')}<input type="range" min="0" max="100" value={(entry.videoPosition?.[axis] ?? 0.5) * 100} onChange={(event) => update(index, { videoPosition: { x: 0.5, y: 0.5, ...entry.videoPosition, [axis]: Number(event.target.value) / 100 } })} /></label>)}
      <div className="supporting-actions"><button type="button" onClick={() => setPreviewIndex(index)}>{t('supportingPreview')}</button><button type="button" onClick={() => replaceDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) })}>{t('supportingRemove')}</button></div>
    </fieldset>)}
    {item && image && <figure className="supporting-preview"><figcaption>{t('supportingPreview')}</figcaption>
      <div className="supporting-preview-frame" style={{ aspectRatio: frameAspectRatio }}>
        <div style={{ height: `${item.topRatio * 100}%` }}><img src={image.src} alt={image.name} style={{ objectPosition: `${(item.imagePosition?.x ?? .5) * 100}% ${(item.imagePosition?.y ?? .5) * 100}%` }} /></div>
        <div style={{ height: `${(1 - item.topRatio) * 100}%` }}>{video?.type === 'video' ? <video ref={previewVideo} src={video.src} muted playsInline preload="metadata" onLoadedMetadata={(event) => { event.currentTarget.currentTime = sourceTime; }} style={{ objectPosition: `${(item.videoPosition?.x ?? .5) * 100}% ${(item.videoPosition?.y ?? .5) * 100}%` }} /> : video?.src ? <img src={video.src} alt={video.name || ''} /> : null}</div>
      </div><small>{t('supportingPreviewHint')}</small>
    </figure>}
    <details><summary>{t('supportingJson')}</summary><p>{t('supportingJsonHint')}</p>
      <label>{t('supportingJson')}<textarea disabled={planning} aria-label={t('supportingJson')} rows={8} value={json} onChange={(event) => { setJson(event.target.value); setJsonDirty(true); }} /></label>
      <button type="button" disabled={planning} onClick={loadJson}>{t('supportingJsonLoad')}</button>
      <label>{t('supportingData')}<textarea readOnly rows={6} value={JSON.stringify({ captions: captionSegments.map(({ id, text, start, end }) => ({ id, text, start, end })), images: assets.map(({ id, name }) => ({ id, name })), timelineDuration }, null, 2)} /></label>
    </details>
    <button type="button" className="primary" disabled={planning || !draft?.items.length || jsonDirty || !onApply} onClick={apply}>{t('supportingApply')}</button>
  </section>;
}
