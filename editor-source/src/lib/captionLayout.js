import {
  DEFAULT_CAPTION_FONT_ID,
  resolveCaptionFontFamily,
  resolveCaptionFontWeight,
} from "./captionFonts.js";
import { DEFAULT_CAPTION_HIGHLIGHT_COLOR, getCaptionLineRuns } from "./captionHighlights.js";

const CAPTION_FONT_WEIGHT = 700;
const CAPTION_LINE_HEIGHT = 1.35;
const CAPTION_PADDING_X = 22;
const CAPTION_PADDING_Y = 12;
const CAPTION_MIN_HEIGHT = 44;
const CAPTION_MIN_WIDTH_RATIO = 0.32;
const CAPTION_MAX_WIDTH_RATIO = 0.68;
const PORTRAIT_CAPTION_MAX_WIDTH_RATIO = 0.92;
const CAPTION_MAX_WIDTH = 680;
const CAPTION_RADIUS = 7;
const CAPTION_SHADOW_BLUR = 6;
const CAPTION_SHADOW_OFFSET_Y = 1;
// Caption sizes are authored against a 360px-tall design frame. Subtitles are
// read across the horizontal baseline, so their perceived size should follow
// media height: a 9:16 canvas needs larger type than a 16:9 canvas shown at the
// same width. Width-based/short-edge scaling made portrait captions tiny.
export const CAPTION_DESIGN_HEIGHT = 360;

export const CAPTION_FONT_FAMILY =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

function toPositiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeFrameSize(size) {
  return {
    width: toPositiveNumber(size?.width),
    height: toPositiveNumber(size?.height),
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function getCaptionScale(_referenceFrame, renderFrame) {
  const render = normalizeFrameSize(renderFrame);
  if (!render.height) {
    return 1;
  }
  return render.height / CAPTION_DESIGN_HEIGHT;
}

export function resolveCaptionMetrics({
  captionSize = 14,
  captionStyle = {},
  referenceFrame,
  renderFrame,
} = {}) {
  const frame = normalizeFrameSize(renderFrame);
  const scale = getCaptionScale(referenceFrame, frame);
  const fontSize = Math.max(1, toPositiveNumber(captionSize, 14) * scale);
  const portrait = frame.height > frame.width && frame.width > 0;
  const horizontalScale = portrait ? frame.width / CAPTION_DESIGN_HEIGHT : scale;
  const paddingX = toPositiveNumber(captionStyle.paddingX, CAPTION_PADDING_X) * horizontalScale;
  const paddingY = toPositiveNumber(captionStyle.paddingY, CAPTION_PADDING_Y) * scale;
  const minWidth = frame.width * CAPTION_MIN_WIDTH_RATIO;
  const maxWidth = Math.max(
    minWidth,
    Math.min(frame.width * (portrait ? PORTRAIT_CAPTION_MAX_WIDTH_RATIO : CAPTION_MAX_WIDTH_RATIO), CAPTION_MAX_WIDTH * scale),
  );
  const fontId = captionStyle.fontId || DEFAULT_CAPTION_FONT_ID;
  const fontFamily = resolveCaptionFontFamily(fontId);
  const fontWeight = resolveCaptionFontWeight(fontId);

  return {
    scale,
    fontSize,
    fontId,
    fontWeight,
    fontFamily,
    font: `${fontWeight} ${fontSize}px ${fontFamily}`,
    lineHeight: fontSize * CAPTION_LINE_HEIGHT,
    paddingX,
    paddingY,
    minHeight: CAPTION_MIN_HEIGHT * scale,
    minWidth,
    maxWidth,
    radius: toPositiveNumber(captionStyle.radius, CAPTION_RADIUS) * scale,
    shadowBlur: CAPTION_SHADOW_BLUR * scale,
    shadowOffsetY: CAPTION_SHADOW_OFFSET_Y * scale,
  };
}

let measurementContext = null;

export function getCaptionMeasurementContext() {
  if (measurementContext || typeof document === "undefined") {
    return measurementContext;
  }
  const canvas = document.createElement("canvas");
  measurementContext = canvas.getContext("2d");
  return measurementContext;
}

function getGraphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (item) => item.segment);
  }
  return Array.from(text);
}

function getWrapTokens(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    return Array.from(segmenter.segment(text), (item) => item.segment);
  }
  return text.match(/\s+|[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]|[^\s\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+/gu) ?? [];
}

function splitOversizedToken(context, token, maxWidth) {
  const chunks = [];
  let current = "";
  getGraphemes(token).forEach((grapheme) => {
    const candidate = current + grapheme;
    if (current && context.measureText(candidate).width > maxWidth) {
      chunks.push(current);
      current = grapheme;
    } else {
      current = candidate;
    }
  });
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

export function wrapCaptionText(context, text, maxWidth) {
  const safeText = String(text ?? "");
  const paragraphs = safeText.split(/\r?\n/);
  const lines = [];

  paragraphs.forEach((paragraph) => {
    if (!paragraph) {
      lines.push("");
      return;
    }

    let current = "";
    getWrapTokens(paragraph).forEach((token) => {
      const candidate = current + token;
      if (context.measureText(candidate).width <= maxWidth) {
        current = candidate;
        return;
      }

      if (current) {
        lines.push(current.trimEnd());
      }
      const nextToken = token.trimStart();
      if (!nextToken) {
        current = "";
        return;
      }

      if (context.measureText(nextToken).width <= maxWidth) {
        current = nextToken;
        return;
      }

      const chunks = splitOversizedToken(context, nextToken, maxWidth);
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) ?? "";
    });

    lines.push(current.trimEnd());
  });

  return lines.length ? lines : [""];
}

function getFallbackTextWidth(text, fontSize) {
  return getGraphemes(String(text ?? "")).reduce(
    (width, grapheme) => width + (/^[\u0000-\u00ff]$/.test(grapheme) ? fontSize * 0.58 : fontSize),
    0,
  );
}

export function getCaptionTextLayout({
  context = getCaptionMeasurementContext(),
  text = "",
  captionSize = 14,
  captionStyle = {},
  referenceFrame,
  renderFrame,
} = {}) {
  const frame = normalizeFrameSize(renderFrame);
  const metrics = resolveCaptionMetrics({ captionSize, captionStyle, referenceFrame, renderFrame: frame });
  if (context) {
    context.font = metrics.font;
  }

  const paragraphWidths = String(text ?? "")
    .split(/\r?\n/)
    .map((paragraph) =>
      context ? context.measureText(paragraph).width : getFallbackTextWidth(paragraph, metrics.fontSize),
    );
  const preferredTextWidth = Math.max(0, ...paragraphWidths);
  const width = clamp(
    preferredTextWidth + metrics.paddingX * 2,
    metrics.minWidth,
    metrics.maxWidth,
  );
  const contentWidth = Math.max(1, width - metrics.paddingX * 2);
  const measurement = context || { measureText: (value) => ({ width: getFallbackTextWidth(value, metrics.fontSize) }) };
  let wrappedText = String(text ?? "");
  let lines = wrapCaptionText(measurement, wrappedText, contentWidth);
  const originalFontSize = metrics.fontSize;
  if (frame.height > frame.width && frame.width > 0 && lines.length > 2) {
    // Old projects can contain entire paragraphs. Preserve all their words,
    // fitting the rendering only; do not mutate the authored caption style.
    // More than two explicit paragraphs cannot fit two lines at any font size.
    if (wrappedText.split(/\r?\n/).length > 2) wrappedText = wrappedText.replace(/\r?\n/g, " ");
    const wrapAtSize = (fontSize) => {
      metrics.fontSize = fontSize;
      metrics.font = `${metrics.fontWeight} ${fontSize}px ${metrics.fontFamily}`;
      if (context) context.font = metrics.font;
      return wrapCaptionText(measurement, wrappedText, contentWidth);
    };
    let lower = 0;
    let upper = originalFontSize;
    for (let step = 0; step < 24; step += 1) {
      const candidate = (lower + upper) / 2;
      const candidateLines = wrapAtSize(candidate);
      if (candidateLines.length <= 2) lower = candidate;
      else upper = candidate;
    }
    lines = wrapAtSize(lower || originalFontSize / 2 ** 24);
    metrics.lineHeight = metrics.fontSize * CAPTION_LINE_HEIGHT;
  }
  const height = Math.max(
    metrics.minHeight,
    lines.length * metrics.lineHeight + metrics.paddingY * 2,
  );

  return {
    text: String(text ?? ""),
    frame,
    metrics,
    width,
    height,
    contentWidth,
    lines,
    lineRuns: getCaptionLineRuns(lines, wrappedText, captionStyle.highlightWords),
    fontSizeAdjusted: metrics.fontSize < originalFontSize,
    style: captionStyle,
  };
}

function normalizePlacement(placement) {
  if (typeof placement === "string") {
    const placements = {
      top: { x: 50, y: 18 },
      middle: { x: 50, y: 50 },
      bottom: { x: 50, y: 78 },
    };
    return placements[placement] ?? placements.bottom;
  }
  return {
    x: Number.isFinite(Number(placement?.x)) ? Number(placement.x) : 50,
    y: Number.isFinite(Number(placement?.y)) ? Number(placement.y) : 78,
  };
}

export function resolveCaptionSegmentPlacement(segment, fallbackPlacement = "bottom") {
  return segment?.placement ?? fallbackPlacement;
}

export function positionCaptionLayout(layout, placement) {
  const point = normalizePlacement(placement);
  let centerX = (layout.frame.width * point.x) / 100;
  let centerY = (layout.frame.height * point.y) / 100;
  if (layout.frame.height > layout.frame.width && layout.frame.width > 0) {
    const marginX = layout.frame.width * 0.04;
    const marginTop = layout.frame.height * 0.04;
    const marginBottom = layout.frame.height * 0.08;
    centerX = clamp(centerX, marginX + layout.width / 2, layout.frame.width - marginX - layout.width / 2);
    centerY = clamp(centerY, marginTop + layout.height / 2, layout.frame.height - marginBottom - layout.height / 2);
  }
  return {
    x: centerX - layout.width / 2,
    y: centerY - layout.height / 2,
    centerX,
    centerY,
  };
}

function roundedRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, safeRadius);
    return;
  }
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

export function drawCaptionLayout(context, layout, position = { x: 0, y: 0 }) {
  const { metrics } = layout;
  const style = layout.style ?? {};
  const opacity = Math.max(0, Math.min(1, Number(style.backgroundOpacity ?? 0.62)));
  const borderWidth = Math.max(0, Number(style.borderWidth ?? 0)) * metrics.scale;
  context.save();
  roundedRectPath(context, position.x, position.y, layout.width, layout.height, metrics.radius);
  context.fillStyle = style.backgroundColor || "#05080d";
  context.globalAlpha = opacity;
  context.fill();
  context.globalAlpha = 1;
  if (borderWidth) {
    context.lineWidth = borderWidth;
    context.strokeStyle = style.borderColor || "#ffffff";
    context.stroke();
  }

  context.font = metrics.font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = style.textColor || "#f5fbff";
  context.shadowColor = style.effect === "neon" ? (style.borderColor || "#35f0dd") : `rgba(0, 0, 0, ${Math.max(0, Math.min(1, Number(style.shadowOpacity ?? 0.45)))})`;
  context.shadowBlur = style.effect === "neon" ? metrics.shadowBlur * 2.6 : metrics.shadowBlur;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = metrics.shadowOffsetY;
  const blockHeight = layout.lines.length * metrics.lineHeight;
  const firstLineY = position.y + (layout.height - blockHeight) / 2 + metrics.lineHeight / 2;
  layout.lines.forEach((line, index) => {
    const textX = position.x + layout.width / 2;
    const textY = firstLineY + index * metrics.lineHeight;
    const strokeWidth = Math.max(0, Number(style.textStrokeWidth ?? 0)) * metrics.scale;
    if (strokeWidth) {
      context.save();
      context.shadowColor = "transparent";
      context.lineJoin = "round";
      context.miterLimit = 2;
      context.lineWidth = strokeWidth * 2;
      context.strokeStyle = style.textStrokeColor || "#05080d";
      context.strokeText(line, textX, textY, layout.contentWidth);
      context.restore();
    }
    const runs = layout.lineRuns?.[index] || [];
    if (runs.some((run) => run.highlighted)) {
      const textLeft = textX - context.measureText(line).width / 2;
      context.textAlign = "left";
      let prefix = "";
      for (const run of runs) {
        context.fillStyle = run.highlighted
          ? style.highlightColor || DEFAULT_CAPTION_HIGHLIGHT_COLOR
          : style.textColor || "#f5fbff";
        context.fillText(run.text, textLeft + context.measureText(prefix).width, textY);
        prefix += run.text;
      }
      context.textAlign = "center";
      context.fillStyle = style.textColor || "#f5fbff";
    } else {
      context.fillText(line, textX, textY, layout.contentWidth);
    }
  });
  context.restore();
}
