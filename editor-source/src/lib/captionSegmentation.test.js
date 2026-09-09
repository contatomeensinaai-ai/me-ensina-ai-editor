import assert from "node:assert/strict";
import test from "node:test";
import { groupTimedCaptionWords, PORTRAIT_CAPTION_PROFILE } from "./captionSegmentation.js";
import { getCaptionTimeline } from "./timeline.js";

const spokenWords = [
  ["Você", 0.16, 0.4], ["sabia", 0.4, 0.83], ["que", 0.84, 0.98],
  ["a", 0.98, 1.05], ["inteligência", 1.05, 1.88], ["artificial", 1.9, 2.63],
  ["pode", 2.7, 2.94], ["ajudar", 2.98, 3.4], ["a", 3.4, 3.47],
  ["sua", 3.48, 3.63], ["empresa", 3.64, 4.2], ["a", 4.2, 4.27],
  ["crescer", 4.3, 4.84], ["hoje?", 4.84, 5.18],
];
const output = { chunks: spokenWords.map(([text, start, end]) => ({ text: ` ${text}`, timestamp: [start, end] })) };

test("vertical groups keep every word, accents and real unequal speech boundaries", () => {
  const groups = groupTimedCaptionWords(output, { duration: 5.5, language: "pt" });
  assert.ok(groups.length >= 3);
  assert.equal(groups.map((segment) => segment.text).join(" "), spokenWords.map(([text]) => text).join(" "));
  assert.deepEqual(groups.flatMap((segment) => segment.words.map(({ text, start, end }) => [text, start, end])), spokenWords);
  for (const [index, segment] of groups.entries()) {
    assert.ok(segment.text.length <= PORTRAIT_CAPTION_PROFILE.maxCharacters);
    assert.ok(segment.words.length <= PORTRAIT_CAPTION_PROFILE.maxWords);
    assert.equal(segment.start, segment.words[0].start);
    assert.equal(segment.end, segment.words.at(-1).end);
    if (index) assert.ok(segment.start >= groups[index - 1].end);
  }
});

test("a spoken pause remains a gap and offsets apply exactly once", () => {
  const groups = groupTimedCaptionWords({ chunks: [
    { text: " Olá", timestamp: [0.2, 0.61] }, { text: " mundo", timestamp: [1.8, 2.2] },
  ] }, { duration: 3, timelineOffset: 7, language: "pt" });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].start, 7.2);
  assert.equal(groups[0].end, 7.61);
  assert.equal(groups[1].start, 8.8);
});

test("missing or invalid word alignment is rejected rather than divided proportionally", () => {
  for (const chunks of [
    [{ text: "Uma frase inteira sem palavras alinhadas", timestamp: [0, 4] }],
    [{ text: "palavra", timestamp: [null, 1] }],
    [{ text: "palavra", timestamp: [0, null] }],
    [{ text: "palavra", timestamp: [2, 1] }],
  ]) assert.throws(() => groupTimedCaptionWords({ chunks }, { duration: 4, language: "pt" }), /palavra|alinhamento/);
});

test("punctuation shares its real timestamp without minimum-duration expansion", () => {
  const groups = groupTimedCaptionWords({ chunks: [
    { text: " Olá", timestamp: [0.2, 0.51] }, { text: "!", timestamp: [0.51, 0.51] },
    { text: " Tudo", timestamp: [0.7, 0.9] }, { text: " bem?", timestamp: [0.9, 1.15] },
  ] }, { duration: 2, language: "pt" });
  assert.equal(groups[0].text, "Olá!");
  assert.equal(groups[0].end, 0.51);
  assert.equal(groups[1].start, 0.7);
});

test("CJK words are grouped without inserting artificial spaces", () => {
  const groups = groupTimedCaptionWords({ chunks: [
    { text: "你好", timestamp: [0, 0.4] }, { text: "世界", timestamp: [0.4, 0.9] },
  ] }, { duration: 1, language: "zh" });
  assert.equal(groups[0].text, "你好世界");
});

test("the timeline does not expand a short aligned caption into the following word", () => {
  const groups = groupTimedCaptionWords({ chunks: [
    { text: " É.", timestamp: [0.1, 0.22] }, { text: " Sim.", timestamp: [0.22, 0.48] },
  ] }, { duration: 1, language: "pt" });
  const timeline = getCaptionTimeline(groups);
  assert.equal(timeline[0].end, 0.22);
  assert.equal(timeline[1].start, 0.22);
});
