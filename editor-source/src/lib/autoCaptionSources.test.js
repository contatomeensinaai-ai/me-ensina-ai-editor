import assert from "node:assert/strict";
import test from "node:test";
import { getAutoCaptionSources, transcribeCaptionSources } from "./autoCaptionSources.js";

const videoBlob = new Blob(["video"], { type: "video/mp4" });
const audioBlob = new Blob(["audio"], { type: "audio/wav" });
const video = { id: "video-1", type: "video", name: "clip.mov", blob: videoBlob, duration: 6, sourceStart: 0 };

test("first imported video is a caption source without a separated audio track", () => {
  const sources = getAutoCaptionSources({ visualSegments: [video] });
  assert.equal(sources.length, 1);
  assert.equal(sources[0].blob, videoBlob);
  assert.equal(sources[0].extractAudio, true);
  assert.equal(sources[0].start, 0);
});

test("preparing videos, still images and missing media cannot enable caption generation", () => {
  assert.deepEqual(getAutoCaptionSources({ visualSegments: [
    { ...video, preparing: true }, { type: "image", blob: videoBlob, duration: 5 }, { ...video, blob: null },
  ] }), []);
});

test("source audio keeps precedence and unlinked audio keeps its offset", () => {
  const sources = getAutoCaptionSources({ sourceAudioBlob: audioBlob, sourceAudioStart: 3, visualSegments: [video] });
  assert.equal(sources.length, 1);
  assert.equal(sources[0].blob, audioBlob);
  assert.equal(sources[0].start, 3);
  assert.equal(sources[0].extractAudio, undefined);
});

test("visual sources preserve image gaps, trims, and compatibility audio", () => {
  const sources = getAutoCaptionSources({ visualSegments: [
    { type: "image", duration: 2 }, { ...video, sourceStart: 4, duration: 3, playbackRate: 2, compatibilityAudioBlob: audioBlob },
    { ...video, id: "video-2", duration: 4 },
  ] });
  assert.equal(sources[0].start, 2);
  assert.equal(sources[0].sourceStart, 4);
  assert.equal(sources[0].sourceDuration, 6);
  assert.equal(sources[0].blob, audioBlob);
  assert.equal(sources[0].extractAudio, false);
  assert.equal(sources[1].start, 5);
});

test("audio clips also work when neither source nor visual video exists", () => {
  const sources = getAutoCaptionSources({ audioSegments: [{ blob: audioBlob, start: 7, sourceStart: 3, duration: 2, playbackRate: 2 }] });
  assert.equal(sources[0].start, 7);
  assert.equal(sources[0].sourceDuration, 4);
});

test("linked source audio follows the edited linked intervals instead of the entire original", () => {
  const sources = getAutoCaptionSources({
    sourceAudioBlob: audioBlob, sourceAudioLinked: true,
    linkedSourceAudioSegments: [{ start: 4, sourceStart: 9, sourceDuration: 6, duration: 3, playbackRate: 2 }],
  });
  assert.equal(sources[0].blob, audioBlob);
  assert.equal(sources[0].start, 4);
  assert.equal(sources[0].sourceStart, 9);
  assert.equal(sources[0].sourceDuration, 6);
});

test("speed curve captions use the same nonlinear source-time mapping as preview", async () => {
  const sources = getAutoCaptionSources({ visualSegments: [{
    ...video, duration: 4, sourceDuration: 4,
    speedCurve: { enabled: true, smooth: false, points: [{ progress: 0, rate: 0.5 }, { progress: 1, rate: 1.5 }] },
  }] });
  const result = await transcribeCaptionSources(sources, {
    extractAudio: async () => audioBlob,
    sliceAudio: async (blob) => blob,
    transcribe: async () => ({ text: "Test", segments: [{ start: 1.5, end: 4, text: "Test" }] }),
  });
  assert.ok(Math.abs(result.segments[0].start - 2) < 0.01);
  assert.ok(Math.abs(result.segments[0].end - 4) < 0.01);
});

test("transcription extracts video, slices source, and maps captions to edited timeline", async () => {
  const sources = getAutoCaptionSources({ visualSegments: [
    { type: "image", duration: 3 }, { ...video, sourceStart: 5, duration: 2, playbackRate: 2 },
  ] });
  const calls = [];
  const result = await transcribeCaptionSources(sources, {
    extractAudio: async (blob, name) => { calls.push(["extract", blob, name]); return audioBlob; },
    sliceAudio: async (blob, start, duration) => { calls.push(["slice", blob, start, duration]); return blob; },
    transcribe: async (_blob, options) => {
      assert.equal(options.timelineOffset, 0);
      return { text: "Hello", segments: [{ id: "caption-1", text: "Hello", start: 1, end: 3 }] };
    },
  });
  assert.deepEqual(calls, [["extract", videoBlob, "clip.mov"], ["slice", audioBlob, 5, 4]]);
  assert.equal(result.segments[0].start, 3.5);
  assert.equal(result.segments[0].end, 4.5);
});

test("a failed clip prevents publishing a partial caption result", async () => {
  const sources = getAutoCaptionSources({ visualSegments: [video, { ...video, id: "second" }] });
  let calls = 0;
  await assert.rejects(transcribeCaptionSources(sources, {
    extractAudio: async () => audioBlob,
    sliceAudio: async (blob) => blob,
    transcribe: async () => { if (++calls === 2) throw new Error("No audio"); return { text: "First", segments: [] }; },
  }), /No audio/);
});

test("vertical word evidence maps through trim and speed alongside the caption", async () => {
  const sources = getAutoCaptionSources({ visualSegments: [
    { type: "image", duration: 3 }, { ...video, sourceStart: 5, duration: 2, playbackRate: 2 },
  ] });
  const result = await transcribeCaptionSources(sources, {
    portraitCaptions: true,
    extractAudio: async () => audioBlob,
    sliceAudio: async (blob) => blob,
    transcribe: async (_blob, options) => {
      assert.equal(options.portraitCaptions, true);
      return { text: "Olá mundo", segments: [{ start: 1, end: 3, text: "Olá mundo", words: [
        { text: "Olá", start: 1, end: 1.4 }, { text: "mundo", start: 1.5, end: 3 },
      ] }] };
    },
  });
  assert.deepEqual(result.segments[0].words, [
    { text: "Olá", start: 3.5, end: 3.7 }, { text: "mundo", start: 3.75, end: 4.5 },
  ]);
});
