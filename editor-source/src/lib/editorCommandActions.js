import { saveLanguagePreference } from "../i18n.js";
import { normalizeVoiceId } from "../config/editor.js";
import { revokeVisionObjectUrls } from "./editorRuntime.js";
import { createCaptionSegments } from "./timeline.js";

export function createEditorCommandActions(d) {
  function clearAllVisionState() {
    d.visionJobGenerationRef.current += 1;
    d.visionAbortControllerRef.current?.abort();
    d.visionAbortControllerRef.current = null;
    d.visionObjectUrlsRef.current.forEach((urls) => revokeVisionObjectUrls(urls));
    d.visionObjectUrlsRef.current.clear();
    d.setVisionRecords({});
    d.setVisionJob({ running: false, key: "", progress: 0, phase: "" });
  }

  function selectTool(toolId) {
    d.setActiveTool(toolId);
    if (toolId !== "smart") d.setAvatarPanelOpen(false);
    if (["filters", "mask"].includes(toolId)) {
      d.setVisualToolRequest?.((request) => request + 1);
      const visuals = d.visualSegments ?? [];
      const overlays = d.visualOverlaySegments ?? [];
      const base = visuals.find((item) => item.id === d.selectedVisualSegmentId);
      const overlay = overlays.find((item) => item.id === d.selectedVisualOverlayId);
      const target = d.selectedTrack === "overlay" && overlay
        ? { item: overlay, track: "overlay" }
        : base ? { item: base, track: "image" }
          : overlay ? { item: overlay, track: "overlay" }
            : visuals.length + overlays.length === 1
              ? { item: visuals[0] ?? overlays[0], track: visuals.length ? "image" : "overlay" }
              : null;
      d.setSelectedTrack(target?.track ?? "image");
      if (target) {
        if (target.track === "overlay") d.setSelectedVisualOverlayId(target.item.id);
        else d.setSelectedVisualSegmentId(target.item.id);
      } else d.notify(d.t(visuals.length + overlays.length ? "visualShortcutSelect" : "visualShortcutImport"));
      d.setMobilePanelOrigin(d.isCompactViewport ? (target?.track === "overlay" ? "overlay-clip" : "visual-clip") : "");
      d.setMobileInspectorSection(toolId);
      if (d.isCompactViewport) d.setMobilePanel("inspector");
      return;
    }
    d.setMobilePanelOrigin?.("");
    d.setMobileInspectorSection?.("");
    if (toolId === "audio") {
      d.setSelectedTrack("audio");
      d.setVoiceTab("synthesis");
    }
    if (toolId === "media") d.setSelectedTrack("image");
    if (toolId === "caption") d.setSelectedTrack("caption");
    if (toolId === "effects" && !["image", "overlay"].includes(d.selectedTrack)) d.setSelectedTrack("image");
  }

  function chooseInterfaceLanguage(languageId) {
    saveLanguagePreference(languageId);
    d.setIntroClosing(true);
    window.setTimeout(() => {
      d.setUiLanguage(languageId);
      d.setIntroClosing(false);
    }, 520);
  }

  function toggleTrackVisibility(track) {
    d.setTrackVisibility((visibility) => {
      const baseTrack = track.replace(/-\d+$/, "");
      const currentVisibility = visibility[track] ?? visibility[baseTrack] ?? true;
      return { ...visibility, [track]: !currentVisibility };
    });
  }

  function toggleTrackLock(track) {
    d.setTrackLocks((locks) => ({ ...locks, [track]: !locks[track] }));
  }

  function useHistoryItem(item) {
    d.replaceAudio(item.blob, item.duration, item.peaks, `${item.voiceName} 已恢复`, {
      sourceKind: "ai-voice",
      voiceId: item.voiceId,
      voiceName: item.voiceName,
      name: item.voiceName,
    });
    d.setScript(item.script);
    const nextSegments = createCaptionSegments(item.script);
    d.setCaptionSegments(nextSegments);
    d.setSelectedSegmentId(nextSegments[0]?.id ?? "");
    d.setSelectedVoiceId(normalizeVoiceId(item.voiceId));
    d.notify("历史配音已恢复到时间线");
  }

  return {
    chooseInterfaceLanguage, clearAllVisionState, selectTool, toggleTrackLock,
    toggleTrackVisibility, useHistoryItem,
  };
}
