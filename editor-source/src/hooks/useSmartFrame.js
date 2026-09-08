import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RATIO_OPTIONS } from "../config/editor.js";
import { analyzeSmartFrameClip } from "../lib/smartFrameAnalysis.js";
import { buildSmartFrameRecord, normalizeSmartFrame } from "../lib/smartFrame.js";

// The analyzer has a legacy text protocol. Keep it out of the UI and store keys
// so in-flight progress changes language without restarting the analysis.
function progressCopy(stage, phase) {
  const text = String(phase || "");
  const count = text.match(/\b\d+\/\d+\b/)?.[0] || "";
  const key = text.startsWith("光流跟踪") ? "smartFrameTracking"
    : text.startsWith("主体丢失") ? "smartFrameSubjectLost"
      : text.startsWith("稀疏检测") ? "smartFrameDetecting"
        : stage === "setup" ? "smartFrameModelSetup" : "smartFrameClipAnalysis";
  return { phaseKey: key, phaseCount: count };
}

function errorCopy(error) {
  const message = String(error?.message || "");
  if (/没有识别到/.test(message)) return "smartFrameNoSubject";
  if (/不支持.*(?:Worker|光流)/.test(message)) return "smartFrameWorkerUnavailable";
  if (/缺少视频源/.test(message)) return "smartFrameMissingSource";
  if (/视频尺寸无效/.test(message)) return "smartFrameInvalidDimensions";
  if (/分析画布/.test(message)) return "smartFrameCanvasUnavailable";
  return "smartFrameAnalysisFailed";
}

const DEFAULT_SETTINGS = Object.freeze({ motion: "smooth", padding: 0.16, maxZoom: 1.45 });

function getRatio(id) {
  return RATIO_OPTIONS.find((option) => option.id === id) || RATIO_OPTIONS[0];
}

export function useSmartFrame({
  selectedSegment,
  ratioId,
  setRatioId,
  setVisualSegments,
  trackLocked,
  notify,
  t,
}) {
  const translatorRef = useRef(t);
  translatorRef.current = t;
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [analysisTrack, setAnalysisTrack] = useState(null);
  const [targetRatioId, setTargetRatioId] = useState(ratioId || "16:9");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [compareMode, setCompareMode] = useState("after");
  const [job, setJob] = useState({ running: false, stage: "idle", progress: 0, phase: "" });
  const abortRef = useRef(null);
  const selectedIdRef = useRef("");
  const startingRatioRef = useRef(ratioId || "16:9");

  useEffect(() => {
    const id = selectedSegment?.id || "";
    if (id === selectedIdRef.current) return;
    abortRef.current?.abort();
    abortRef.current = null;
    selectedIdRef.current = id;
    startingRatioRef.current = ratioId || "16:9";
    const applied = normalizeSmartFrame(selectedSegment?.smartFrame);
    setBaseline(applied);
    setDraft(applied);
    setAnalysisTrack(applied?.analysisTrack || null);
    setSettings(applied?.settings || DEFAULT_SETTINGS);
    setTargetRatioId(applied?.targetRatio || ratioId || "16:9");
    setCompareMode(applied ? "after" : "original");
    setJob({ running: false, stage: "idle", progress: 0, phase: "" });
  }, [ratioId, selectedSegment?.id, selectedSegment?.smartFrame]);

  const rebuildDraft = useCallback((track, nextRatioId, nextSettings) => {
    if (!track || !selectedSegment) return null;
    const target = getRatio(nextRatioId);
    return buildSmartFrameRecord({
      ...track,
      targetSize: { width: target.width, height: target.height },
      targetRatio: target.id,
      segment: selectedSegment,
      settings: nextSettings,
    });
  }, [selectedSegment]);

  const analyze = useCallback(async () => {
    if (!selectedSegment || !["image", "video"].includes(selectedSegment.type)) {
      notify?.(translatorRef.current("smartFrameSelectClip"));
      return;
    }
    if (trackLocked) {
      notify?.(translatorRef.current("smartFrameTrackLocked"));
      return;
    }
    if (job.running) {
      abortRef.current?.abort();
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRatioId(targetRatioId);
    setCompareMode("after");
    setJob({ running: true, stage: "setup", progress: 1, phaseKey: "smartFramePreparingClip" });
    const startedAt = performance.now();
    try {
      const track = await analyzeSmartFrameClip({
        segment: selectedSegment,
        signal: controller.signal,
        onProgress: ({ stage, progress, phase }) => setJob({
          running: true,
          stage,
          progress: Math.max(0, Math.min(100, Number(progress) || 0)),
          ...progressCopy(stage, phase),
        }),
      });
      track.analysisMs = Math.max(0, performance.now() - startedAt);
      const nextDraft = rebuildDraft(track, targetRatioId, settings);
      setAnalysisTrack(track);
      setDraft(nextDraft);
      setJob({ running: false, stage: "complete", progress: 100, phaseKey: "smartFramePreviewReady", elapsedMs: track.analysisMs });
      notify?.(translatorRef.current("smartFramePreviewNotice"));
    } catch (error) {
      if (error?.name === "AbortError") {
        setJob({ running: false, stage: "idle", progress: 0, phaseKey: "smartFrameCanceled" });
        return;
      }
      setJob({ running: false, stage: "error", progress: 0, phaseKey: errorCopy(error) });
      notify?.(translatorRef.current(errorCopy(error)));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [job.running, notify, rebuildDraft, selectedSegment, setRatioId, settings, targetRatioId, trackLocked]);

  const changeTargetRatio = useCallback((nextRatioId) => {
    const next = getRatio(nextRatioId).id;
    setTargetRatioId(next);
    setRatioId(next);
    if (analysisTrack) setDraft(rebuildDraft(analysisTrack, next, settings));
    setCompareMode("after");
  }, [analysisTrack, rebuildDraft, setRatioId, settings]);

  const changeSettings = useCallback((patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (analysisTrack) setDraft(rebuildDraft(analysisTrack, targetRatioId, next));
  }, [analysisTrack, rebuildDraft, settings, targetRatioId]);

  const apply = useCallback(() => {
    if (!selectedSegment?.id || !draft || trackLocked) return;
    const applied = normalizeSmartFrame(draft);
    setVisualSegments((segments) => segments.map((segment) => segment.id === selectedSegment.id
      ? { ...segment, smartFrame: applied }
      : segment));
    setBaseline(applied);
    setDraft(applied);
    setCompareMode("after");
    notify?.(translatorRef.current("smartFrameApplied"));
  }, [draft, notify, selectedSegment?.id, setVisualSegments, trackLocked]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAnalysisTrack(baseline?.analysisTrack || null);
    setDraft(baseline);
    setSettings(baseline?.settings || DEFAULT_SETTINGS);
    setTargetRatioId(baseline?.targetRatio || startingRatioRef.current || ratioId);
    setRatioId(baseline?.targetRatio || startingRatioRef.current || ratioId);
    setCompareMode(baseline ? "after" : "original");
    setJob({ running: false, stage: "idle", progress: 0, phase: "" });
    notify?.(translatorRef.current("smartFrameAdjustmentsCanceled"));
  }, [baseline, notify, ratioId, setRatioId]);

  const remove = useCallback(() => {
    if (!selectedSegment?.id || trackLocked) return;
    setVisualSegments((segments) => segments.map((segment) => {
      if (segment.id !== selectedSegment.id) return segment;
      const { smartFrame: _smartFrame, ...rest } = segment;
      return rest;
    }));
    setBaseline(null);
    setDraft(null);
    setAnalysisTrack(null);
    setCompareMode("original");
    notify?.(translatorRef.current("smartFrameRemoved"));
  }, [notify, selectedSegment?.id, setVisualSegments, trackLocked]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const previewOverride = compareMode === "original" ? false : draft || baseline || undefined;
  return useMemo(() => ({
    segment: selectedSegment,
    draft,
    applied: baseline,
    targetRatioId,
    settings,
    compareMode,
    job: { ...job, phase: job.phaseKey ? `${t(job.phaseKey)}${job.phaseCount ? ` ${job.phaseCount}` : ""}` : "" },
    previewOverride,
    dirty: Boolean(draft && (!baseline || JSON.stringify(draft) !== JSON.stringify(baseline))),
    analyze,
    apply,
    cancel,
    remove,
    setCompareMode,
    setTargetRatioId: changeTargetRatio,
    setSettings: changeSettings,
  }), [
    analyze, apply, baseline, cancel, changeSettings, changeTargetRatio,
    compareMode, draft, job, previewOverride, remove, selectedSegment, settings, targetRatioId, t,
  ]);
}
