import assert from "node:assert/strict";
import test from "node:test";
import { parseCaptionKeywords, getCaptionKeywordRanges, getCaptionLineRuns } from "./captionHighlights.js";
import { getCaptionTextLayout, drawCaptionLayout } from "./captionLayout.js";
import { resolveCaptionStyleForSegment } from "./captionFonts.js";
import { createProjectArchive, readProjectArchive } from "./projectArchive.js";

test("keywords parse comma/newline-separated phrases, deduplicating without markup", () => {
  assert.deepEqual(parseCaptionKeywords(" editor, Codex, Claude Code\nIA, ia, live, segunda, direct "), ["editor", "Codex", "Claude Code", "IA", "live", "segunda", "direct"]);
});

test("only whole words/phrases match, ignoring case and preferring longest overlap", () => {
  const text = "A mídia social usa IA, Codex e Claude Code na segunda live.";
  const ranges = getCaptionKeywordRanges(text, ["IA", "Claude", "Claude Code", "Codex", "live"]);
  assert.deepEqual(ranges.map(({ start, end }) => text.slice(start, end)), ["IA", "Codex", "Claude Code", "live"]);
  assert.equal(getCaptionKeywordRanges("social inteligência", ["IA"]).length, 0);
  assert.equal(getCaptionKeywordRanges("Use C++ e não C", ["C++"]).length, 1);
});

test("multiword highlights survive wrapping without coloring the rest of the line", () => {
  const runs = getCaptionLineRuns(["Use Claude", "Code nesta live."], "Use Claude Code nesta live.", ["Claude Code", "live"]);
  assert.deepEqual(runs, [
    [{ text: "Use ", highlighted: false }, { text: "Claude", highlighted: true }],
    [{ text: "Code", highlighted: true }, { text: " nesta ", highlighted: false }, { text: "live", highlighted: true }, { text: ".", highlighted: false }],
  ]);
});

function canvasContext() {
  const paints = [];
  const context = {
    font: "", fillStyle: "", paints,
    measureText(text) { return { width: text.length * (Number(this.font.match(/ ([\d.]+)px /)?.[1]) || 14) * 0.5 }; },
    save() {}, restore() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, strokeText() {},
    fillText(text, x, y) { paints.push({ text, x, y, color: this.fillStyle }); },
  };
  return context;
}

test("shared preview/export drawing changes only selected word colors and keeps layout", () => {
  const context = canvasContext();
  const base = { fontId: "default", textColor: "#ffffff", backgroundColor: "#071517" };
  const resolved = resolveCaptionStyleForSegment(base, { highlightWords: ["Codex", "IA"], highlightColor: "#35f0dd" });
  const options = { context, text: "Use Codex com IA", captionSize: 14, renderFrame: { width: 296, height: 526 } };
  const plain = getCaptionTextLayout({ ...options, captionStyle: base });
  const highlighted = getCaptionTextLayout({ ...options, captionStyle: resolved });
  assert.deepEqual(highlighted.lines, plain.lines);
  assert.equal(highlighted.width, plain.width);
  assert.equal(highlighted.metrics.font, plain.metrics.font);
  drawCaptionLayout(context, highlighted);
  assert.equal(context.paints.filter((item) => item.color === "#35f0dd").map((item) => item.text).join(" "), "Codex IA");
  assert.equal(context.paints.filter((item) => item.color === "#ffffff").map((item) => item.text).join(""), "Use  com ");
});

test("portable timeline roundtrip preserves editable keywords/color and original style", async () => {
  const project = { captionStyle: { textColor: "#ffffff", fontId: "default" }, captionSegments: [
    { id: "c1", text: "Use Codex com IA", start: 0, end: 2, highlightWords: ["Codex", "IA"], highlightColor: "#35f0dd" },
  ] };
  const archive = await createProjectArchive({ project });
  const restored = await readProjectArchive(archive);
  assert.deepEqual(restored.payload.project.captionSegments, project.captionSegments);
  assert.deepEqual(restored.payload.project.captionStyle, project.captionStyle);
});
