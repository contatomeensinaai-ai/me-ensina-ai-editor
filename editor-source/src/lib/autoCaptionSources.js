import { getVisualSegmentTimeline } from "./timeline.js";
import { getVisualSourceTime } from "./visualEffects.js";

const hasMedia = (blob) => blob instanceof Blob && blob.size > 0;

function clipSource(segment, start, extra = {}) {
  const playbackRate = Math.max(0.25, Math.min(4, Number(segment.playbackRate) || 1));
  return {
    blob: segment.blob,
    name: segment.name,
    start: Math.max(0, Number(start) || 0),
    sourceStart: Math.max(0, Number(segment.sourceStart) || 0),
    duration: segment.duration,
    sourceDuration: Number(segment.sourceDuration) || segment.duration * playbackRate,
    playbackRate,
    visualSegment: segment.type === "video" || segment.speedCurve?.enabled ? segment : undefined,
    ...extra,
  };
}

// The first imported video goes directly to Visuals, not the separated Source
// track. Caption availability and the generation action must resolve the same inputs.
export function getAutoCaptionSources({
  sourceAudioBlob, sourceAudioStart = 0, sourceAudioLinked = false,
  linkedSourceAudioSegments = [], visualSegments = [], audioSegments = [],
} = {}) {
  if (hasMedia(sourceAudioBlob)) {
    if (sourceAudioLinked && linkedSourceAudioSegments.length) {
      return linkedSourceAudioSegments.map((segment) => clipSource(segment, segment.start, { blob: sourceAudioBlob }));
    }
    return [{ blob: sourceAudioBlob, start: sourceAudioStart, playbackRate: 1 }];
  }
  const timeline = getVisualSegmentTimeline(visualSegments);
  const visuals = visualSegments.flatMap((segment, index) => {
    if (segment.type !== "video" || segment.preparing || !hasMedia(segment.blob) || !(segment.duration > 0)) return [];
    const compatible = hasMedia(segment.compatibilityAudioBlob);
    return [clipSource(segment, timeline[index].start, {
      blob: compatible ? segment.compatibilityAudioBlob : segment.blob,
      extractAudio: !compatible,
    })];
  });
  if (visuals.length) return visuals;
  return audioSegments.filter((segment) => hasMedia(segment.blob) && segment.duration > 0)
    .map((segment) => clipSource(segment, segment.start));
}

function captionTimelineTime(source, elapsed) {
  const time = Math.max(0, Number(elapsed) || 0);
  if (source.visualSegment?.speedCurve?.enabled) {
    // Invert the same source-time mapping used by preview/export, including curves.
    let low = 0;
    let high = source.duration;
    const target = source.sourceStart + time;
    for (let step = 0; step < 36; step += 1) {
      const middle = (low + high) / 2;
      if (getVisualSourceTime(source.visualSegment, middle) < target) low = middle;
      else high = middle;
    }
    return source.start + (low + high) / 2;
  }
  return source.start + Math.min(source.duration ?? Infinity, time / (source.playbackRate || 1));
}

export async function transcribeCaptionSources(sources, { extractAudio, sliceAudio, transcribe, preferredLanguage, portraitCaptions = false, onProgress }) {
  const segments = [];
  const texts = [];
  for (const [index, source] of sources.entries()) {
    const audio = source.extractAudio ? await extractAudio(source.blob, source.name) : source.blob;
    const clip = Number.isFinite(source.sourceDuration)
      ? await sliceAudio(audio, source.sourceStart || 0, source.sourceDuration)
      : audio;
    const result = await transcribe(clip, {
      preferredLanguage,
      portraitCaptions,
      timelineOffset: 0,
      onProgress: (event) => onProgress?.({ ...event, progress: (index * 100 + event.progress) / sources.length }),
    });
    texts.push(result.text);
    segments.push(...result.segments.map((segment) => ({
      ...segment,
      start: captionTimelineTime(source, segment.start),
      end: captionTimelineTime(source, segment.end),
      ...(segment.words ? { words: segment.words.map((word) => ({
        ...word, start: captionTimelineTime(source, word.start), end: captionTimelineTime(source, word.end),
      })) } : {}),
    })).filter((segment) => segment.end > segment.start));
  }
  return { text: texts.filter(Boolean).join("\n"), segments };
}
