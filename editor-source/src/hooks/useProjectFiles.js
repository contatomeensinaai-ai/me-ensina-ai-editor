import { saveLocalArtifact } from "../lib/localArtifactSave.js";
import { useCallback, useRef } from "react";
import { DEFAULT_SCRIPT, DEFAULT_TIMELINE_DURATION_SECONDS, normalizeVoiceId, RATIO_OPTIONS, VOICES } from "../config/editor.js";
import { decodeWaveform } from "../lib/media.js";
import { createProjectArchive, readProjectArchive, readProjectFileAsText, resolveProjectVisualMedia, validateProjectArchive } from "../lib/projectArchive.js";
import { createCaptionSegments, getImageThumbnailCount, getVisualSegmentsTotal } from "../lib/timeline.js";
import { normalizeSmartFrame } from "../lib/smartFrame.js";
import { normalizeTrackLocks, normalizeTrackVisibility } from "../lib/projectTrackState.js";
import { normalizeTimelineMarkers } from "../lib/timelineMarkers.js";
import { serializeVisualSegment, hydrateVisualRestorations } from "../lib/restorationMedia.js";

export function useProjectFiles(deps) {
  const restoreGenerationRef = useRef(0);
  const commandStateRef = useRef({ schemaVersion: 1, revision: 0, appliedOperationIds: [] });
  const getProjectSnapshot = useCallback(() => {
    const visualSegments = deps.visualSegments.map(serializeVisualSegment);
    const visualOverlaySegments = deps.visualOverlaySegments.map(serializeVisualSegment);
    const audioSegments = deps.audioSegments.map(({ blob, url, peaks, ...segment }) => segment);
    return {
      script: deps.script, commandState: commandStateRef.current, selectedVoiceId: deps.selectedVoiceId, speed: deps.speed, volume: deps.volume,
      ratioId: deps.ratioId, fitMode: deps.fitMode, captionPosition: deps.captionPosition,
      captionPlacement: deps.captionPlacement, captionSize: deps.captionSize, captionStyle: deps.captionStyle,
      captionStylePresetId: deps.captionStylePresetId, captionStylePresets: deps.captionStylePresets,
      captionsEnabled: deps.captionsEnabled, captionSegments: deps.captionSegments, audioSegments, musicSegments: deps.musicSegments, visualSegments, visualOverlaySegments,
      stickerSegments: deps.stickerSegments, selectedFilterId: deps.selectedFilterId,
      timelineMarkers: normalizeTimelineMarkers(deps.timelineMarkers),
      selectedTransitionId: deps.selectedTransitionId, selectedStickerId: deps.selectedStickerId,
      trackVisibility: deps.trackVisibility, trackLocks: deps.trackLocks, timelineZoom: deps.timelineZoom, audioDuration: deps.audioDuration,
      musicName: deps.musicName, musicDuration: deps.musicDuration, musicVolume: deps.musicVolume,
      sourceAudioName: deps.sourceAudioName, sourceAudioDuration: deps.sourceAudioDuration,
      sourceAudioStart: deps.sourceAudioStart, sourceAudioVolume: deps.sourceAudioVolume,
      sourceAudioSpatialEffect: deps.sourceAudioSpatialEffect, sourceAudioSpatialAmount: deps.sourceAudioSpatialAmount,
      musicStart: deps.musicStart,
      sourceAudioAssetId: deps.sourceAudioAssetId, sourceAudioLinked: deps.sourceAudioLinked,
    };
  }, [deps]);

  const getProjectArchiveInput = useCallback(() => ({
    project: getProjectSnapshot(), visualSegments: [...deps.visualSegments, ...deps.visualOverlaySegments],
    audioSegments: deps.audioSegments,
    audio: deps.audioBlob ? { blob: deps.audioBlob, name: "voiceover" } : null,
    sourceAudio: deps.sourceAudioBlob ? { blob: deps.sourceAudioBlob, name: deps.sourceAudioName || "source-audio" } : null,
    music: deps.musicBlob ? { blob: deps.musicBlob, name: deps.musicName || "background-music" } : null,
  }), [deps, getProjectSnapshot]);
  const handleExportProject = useCallback(async () => {
    deps.setShowFileMenu(false);
    try {
      deps.notify(deps.t("projectPacking"));
      const archive = await createProjectArchive(getProjectArchiveInput());
      const receipt = await saveLocalArtifact(archive, "Timeline-Studio.timeline", { language: deps.language });
      deps.onArtifactSaved?.(receipt);
      deps.notify(deps.t("artifactSaved").replace("{path}", receipt.path));
      return receipt;
    } catch (error) {
      deps.notify(`${deps.t("projectSaveFailed")}: ${error.message || ""}`);
      return null;
    }
  }, [deps, getProjectArchiveInput]);

  const handleNewProject = useCallback(() => {
    deps.setShowFileMenu(false);
    deps.setShowNewProjectConfirmation(true);
  }, [deps]);

  const confirmNewProject = useCallback(() => {
    restoreGenerationRef.current += 1;
    commandStateRef.current = { schemaVersion: 1, revision: 0, appliedOperationIds: [] };
    deps.clearImageTrack(""); deps.clearAudioTrack("");
    deps.clearSourceAudioTrack(""); deps.clearMusicTrack("");
    // Audio cleanup may enqueue a functional caption unlink. Empty captions last.
    deps.setScript(""); deps.setCaptionSegments([]); deps.setSelectedSegmentId("");
    deps.setVisualOverlaySegments([]); deps.setSelectedVisualOverlayId("");
    deps.setStickerSegments([]); deps.setSelectedStickerSegmentId("");
    deps.setTimelineMarkers?.([]); deps.clearAllVisionState(); deps.setCurrentTime(0);
    deps.markTimelineViewRestored?.(false);
    deps.setTimelineHorizon(DEFAULT_TIMELINE_DURATION_SECONDS); deps.setTimelineZoom(1);
    deps.notify(deps.t("projectNewCreated"));
    deps.setShowNewProjectConfirmation(false);
  }, [deps]);

  const restoreProjectArchive = useCallback(async (archive) => {
      const generation = ++restoreGenerationRef.current;
      validateProjectArchive(archive);
      const { payload, visualMedia, audioSegmentMedia, audio, sourceAudio, music } = archive;
      const data = payload.project;
      const decodedMedia = new Map();
      const mediaBlobs = [audio, sourceAudio, music, ...[...(audioSegmentMedia?.values() || [])].map(item => item.blob)].filter(blob => blob instanceof Blob);
      await Promise.all([...new Set(mediaBlobs)].map(async blob => {
        const decoded = await decodeWaveform(blob);
        if (!decoded || !Number.isFinite(decoded.duration) || decoded.duration <= 0 || !Array.isArray(decoded.peaks)) throw new Error(deps.t("projectInvalid"));
        decodedMedia.set(blob, decoded);
      }));
      if (generation !== restoreGenerationRef.current) return false;
      const markers = normalizeTimelineMarkers(data.timelineMarkers);
      let inheritedCaptionFontId = data.captionStyle?.fontId || "default";
      const captions = (data.captionSegments || createCaptionSegments(data.script || DEFAULT_SCRIPT)).map(segment => {
        inheritedCaptionFontId = segment.fontId || inheritedCaptionFontId;
        return segment.fontId ? segment : { ...segment, fontId: inheritedCaptionFontId };
      });
      const importedVoice = VOICES.find(voice => voice.id === normalizeVoiceId(data.selectedVoiceId)) ?? VOICES[0];
      const visibility = normalizeTrackVisibility(data.trackVisibility);
      const locks = normalizeTrackLocks(data.trackLocks);
      const allocatedUrls = [];
      const visualUrls = [];
      let visuals, overlays, restoredAudioSegments, sourceUrl, musicUrl, restoredMusicSegments, visualDuration, imageClipCount;
      const allocate = blob => { const url = URL.createObjectURL(blob); allocatedUrls.push(url); return url; };
      const allocateVisual = blob => { const url = allocate(blob); visualUrls.push(url); return url; };
      try {
        const restoreVisual = segment => {
          const media = resolveProjectVisualMedia(visualMedia, segment);
          return media?.blob ? hydrateVisualRestorations({ ...segment, src: allocateVisual(media.blob), blob: media.blob }, visualMedia, allocateVisual) : segment.src ? segment : null;
        };
        visuals = (data.visualSegments || []).map(restoreVisual).filter(Boolean).map(restored => {
          const smartFrame = normalizeSmartFrame(restored.smartFrame);
          if (smartFrame) return { ...restored, smartFrame };
          const { smartFrame: _smartFrame, ...withoutSmartFrame } = restored;
          return withoutSmartFrame;
        });
        overlays = (data.visualOverlaySegments || []).map(restoreVisual).filter(Boolean);
        restoredAudioSegments = (data.audioSegments || []).map(segment => {
          const blob = audioSegmentMedia?.get(segment.id)?.blob || audio;
          return blob ? { ...segment, blob, url: allocate(blob), peaks: decodedMedia.get(blob).peaks } : null;
        }).filter(Boolean);
        if (!restoredAudioSegments.length && audio) {
          const decoded = decodedMedia.get(audio);
          const duration = data.audioDuration || decoded.duration;
          restoredAudioSegments = [{ id: crypto.randomUUID(), blob: audio, url: allocate(audio), start: 0, duration,
            sourceStart: 0, sourceDuration: duration, playbackRate: 1, peaks: decoded.peaks, volume: 1,
            fadeIn: 0, fadeOut: 0, reversed: false, name: payload.media?.audio?.name || "voiceover" }];
        }
        sourceUrl = sourceAudio ? allocate(sourceAudio) : null;
        musicUrl = music ? allocate(music) : null;
        restoredMusicSegments = music && data.musicSegments?.length
          ? data.musicSegments.map(segment => ({ ...segment, peaks: decodedMedia.get(music).peaks })) : null;
        visualDuration = getVisualSegmentsTotal(visuals);
        imageClipCount = getImageThumbnailCount(visualDuration);
      } catch (error) {
        allocatedUrls.forEach(url => URL.revokeObjectURL(url));
        throw error;
      }
      // All validation, decoding, normalization and URL allocation precede publication.
      // React setters below are synchronous; arbitrary exceptions from consumer callbacks
      // cannot be rolled back by this hook.
      commandStateRef.current = data.commandState || { schemaVersion: 1, revision: 0, appliedOperationIds: [] };
      deps.setTimelineHorizon(DEFAULT_TIMELINE_DURATION_SECONDS);
      deps.setScript(typeof data.script === "string" ? data.script : DEFAULT_SCRIPT);
      deps.markTimelineViewRestored?.(Boolean(captions.length || data.visualSegments?.length || markers.length || audio || sourceAudio || music));
      deps.setCaptionSegments(captions); deps.setSelectedSegmentId(captions[0]?.id ?? "");
      deps.setTimelineMarkers?.(markers);
      deps.setSelectedVoiceId(importedVoice.id);
      deps.setSpeed(Number.isFinite(Number(data.speed)) && Number(data.speed) > 0
        ? Number(data.speed)
        : importedVoice.defaultSpeed ?? 1);
      deps.setVolume(Number.isFinite(Number(data.volume)) ? Number(data.volume) : 1); deps.setRatioId(RATIO_OPTIONS.some((option) => option.id === data.ratioId) ? data.ratioId : "16:9");
      deps.setFitMode(data.fitMode || "contain"); deps.setCaptionPosition(data.captionPosition || "bottom");
      deps.setCaptionPlacement(data.captionPlacement || { x: 50, y: 78 }); deps.setCaptionSize(Number(data.captionSize) || 14);
      deps.setCaptionStyle(data.captionStyle || deps.captionStyle);
      deps.setCaptionStylePresetId?.(data.captionStylePresetId || "classic");
      deps.setCaptionStylePresets?.(Array.isArray(data.captionStylePresets) ? data.captionStylePresets : []);
      deps.setCaptionsEnabled(data.captionsEnabled !== false);
      deps.setTrackVisibility(visibility); deps.setTrackLocks(locks); deps.setTimelineZoom(Number(data.timelineZoom) || 1);
      deps.setSelectedFilterId(data.selectedFilterId || "none"); deps.setSelectedTransitionId(data.selectedTransitionId || "none");
      deps.setSelectedStickerId(data.selectedStickerId || "none"); deps.setStickerSegments(Array.isArray(data.stickerSegments) ? data.stickerSegments : []);
      visualUrls.forEach(url => deps.imageUrlRefs.current.add(url));
      deps.setVisualSegments(visuals); deps.setImageDuration(visualDuration);
      deps.setVisualOverlaySegments(overlays); deps.setSelectedVisualOverlayId("");
      deps.setImageClipCount(imageClipCount); deps.setCurrentVisualAsset(visuals[0] || null);
      deps.audioSegments.forEach(segment => { if (segment.url?.startsWith("blob:")) URL.revokeObjectURL(segment.url); });
      deps.setAudioSegments(restoredAudioSegments);
      deps.setSelectedAudioSegmentId(restoredAudioSegments[0]?.id || "");
      if (sourceAudio) { const decoded = decodedMedia.get(sourceAudio); deps.replaceSourceAudio(sourceAudio, Number(data.sourceAudioDuration) || decoded.duration, decoded.peaks, data.sourceAudioName || "source-audio", "", Number(data.sourceAudioStart) || 0, data.sourceAudioAssetId || "", { focusAudio: false, preparedUrl: sourceUrl }); } else deps.clearSourceAudioTrack("");
      if (music) {
        const decoded = decodedMedia.get(music);
        deps.replaceMusic(music, Number(data.musicDuration) || decoded.duration, decoded.peaks, data.musicName || "background-music", "", { focusAudio: false, preparedUrl: musicUrl });
        deps.setMusicStart(Math.max(0, Number(data.musicStart) || 0));
        if (restoredMusicSegments) deps.setMusicSegments(restoredMusicSegments);
      } else deps.clearMusicTrack("");
      deps.setMusicVolume(Number.isFinite(Number(data.musicVolume)) ? Number(data.musicVolume) : 0.35); deps.setSourceAudioVolume(Number.isFinite(Number(data.sourceAudioVolume)) ? Number(data.sourceAudioVolume) : 1);
      deps.setSourceAudioSpatialEffect(data.sourceAudioSpatialEffect || "original"); deps.setSourceAudioSpatialAmount(Number.isFinite(Number(data.sourceAudioSpatialAmount)) ? Number(data.sourceAudioSpatialAmount) : 1);
      deps.setSourceAudioAssetId(data.sourceAudioAssetId || ""); deps.setSourceAudioLinked(data.sourceAudioLinked !== false);
      deps.setCurrentTime(0); deps.clearAllVisionState(); deps.setShowFileMenu(false);
      deps.notify(deps.t(archive.legacy ? "projectLegacyRestored" : "projectRestored"));
      return true;
  }, [deps]);

  const handleImportProject = useCallback(async (file) => {
    if (!file) { deps.projectFileInputRef.current?.click(); return; }
    const importGeneration = ++restoreGenerationRef.current;
    try {
      let archive;
      try { archive = await readProjectArchive(file); }
      catch (archiveError) {
        const legacy = JSON.parse(await readProjectFileAsText(file));
        if (legacy?.format !== "timeline-studio-project" || !legacy.project) throw archiveError;
        archive = { payload: { ...legacy, media: { visuals: [] } }, visualMedia: new Map(), audio: null, sourceAudio: null, music: null, legacy: true };
      }
      if (importGeneration !== restoreGenerationRef.current) return false;
      return await restoreProjectArchive(archive);
    } catch { deps.notify(deps.t("projectInvalid")); }
    finally { if (deps.projectFileInputRef.current) deps.projectFileInputRef.current.value = ""; }
  }, [deps, restoreProjectArchive]);

  return { handleExportProject, handleImportProject, handleNewProject, confirmNewProject, getProjectArchiveInput, restoreProjectArchive };
}
