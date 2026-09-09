import assert from "node:assert/strict";
import test from "node:test";
import { getCaptionTextLayout, positionCaptionLayout, resolveCaptionMetrics } from "./captionLayout.js";

const portrait = { width: 296, height: 296 * 16 / 9 };
const legacyText = "Você pode usar inteligência artificial para transformar sua empresa hoje mesmo.";
function layout(text = legacyText, frame = portrait, style = {}) {
  return getCaptionTextLayout({ context: null, text, captionSize: 24, captionStyle: style, renderFrame: frame });
}
const words = (text) => text.trim().split(/\s+/);

test("portrait caption uses 92% width and horizontal padding follows width", () => {
  const metrics = resolveCaptionMetrics({ renderFrame: portrait });
  assert.ok(Math.abs(metrics.maxWidth / portrait.width - 0.92) < 1e-9);
  assert.ok(metrics.paddingX < 20);
});

test("legacy text fits two lines without losing words or changing its saved style", () => {
  const style = { textColor: "#abcdef", fontId: "default", backgroundOpacity: 0.3 };
  const result = layout(legacyText, portrait, style);
  assert.ok(result.lines.length <= 2);
  assert.deepEqual(words(result.lines.join(" ")), words(legacyText));
  assert.equal(result.style, style);
  assert.ok(result.metrics.fontSize < 24 * portrait.height / 360);
  assert.ok(result.metrics.fontSize > 10);
});

test("short captions keep the authored font size and explicit padding", () => {
  const result = layout("Olá!", portrait, { paddingX: 10 });
  assert.ok(Math.abs(result.metrics.fontSize - 24 * portrait.height / 360) < 1e-9);
  assert.ok(Math.abs(result.metrics.paddingX - 10 * portrait.width / 360) < 1e-9);
});

test("hard breaks in legacy captions retain all words within two lines", () => {
  const result = layout("Uma frase\nOutra frase\nMais uma frase");
  assert.ok(result.lines.length <= 2);
  assert.deepEqual(words(result.lines.join(" ")), words("Uma frase Outra frase Mais uma frase"));
});

test("preview and export produce equal line breaks and proportional geometry", () => {
  const preview = layout();
  const exported = layout(legacyText, { width: 1080, height: 1920 });
  const ratio = 1080 / portrait.width;
  assert.deepEqual(exported.lines, preview.lines);
  for (const key of ["width", "height"]) assert.ok(Math.abs(exported[key] - preview[key] * ratio) < 0.01);
  assert.ok(Math.abs(exported.metrics.fontSize - preview.metrics.fontSize * ratio) < 0.01);
});

test("portrait positioning stays inside safe edges and keeps intentional interior positions", () => {
  const result = layout();
  const corner = positionCaptionLayout(result, { x: 100, y: 100 });
  assert.ok(corner.x + result.width <= portrait.width * 0.96 + 1e-6);
  assert.ok(corner.y + result.height <= portrait.height * 0.92 + 1e-6);
  const middle = positionCaptionLayout(result, { x: 50, y: 50 });
  assert.equal(middle.centerY, portrait.height / 2);
  const bottom = positionCaptionLayout(result, "bottom");
  assert.ok(Math.abs(bottom.centerY - portrait.height * 0.78) < 1e-9);
});

test("landscape retains existing width, size and intentional placement", () => {
  const frame = { width: 640, height: 360 };
  const result = layout(legacyText, frame);
  assert.equal(result.metrics.maxWidth, frame.width * 0.68);
  assert.equal(result.metrics.paddingX, 22);
  assert.equal(result.metrics.fontSize, 24);
  assert.equal(positionCaptionLayout(result, { x: 20, y: 90 }).centerX, 128);
});

test("canvas-measured captions also fit two lines and preserve every glyph", () => {
  const context = {
    font: "",
    measureText(text) {
      const size = Number(this.font.match(/ ([\d.]+)px /)?.[1]);
      return { width: Array.from(text).length * size * 0.62 };
    },
  };
  for (const text of [legacyText, "Extraordinariamente".repeat(5), "你好世界".repeat(12)]) {
    const result = getCaptionTextLayout({ context, text, captionSize: 24, renderFrame: portrait });
    assert.ok(result.lines.length <= 2);
    assert.equal(result.lines.join("").replace(/\s/g, ""), text.replace(/\s/g, ""));
    for (const line of result.lines) assert.ok(context.measureText(line).width <= result.contentWidth + 1e-6);
  }
});
