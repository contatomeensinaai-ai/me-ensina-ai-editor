export const DEFAULT_CAPTION_HIGHLIGHT_COLOR = "#35f0dd";

export function parseCaptionKeywords(input = []) {
  const terms = Array.isArray(input) ? input : String(input).split(/[,\n]/u);
  const seen = new Set();
  return terms.map((term) => String(term).trim().replace(/\s+/gu, " ")).filter((term) => {
    const key = term.toLocaleLowerCase();
    if (!term || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getCaptionKeywordRanges(text = "", input = []) {
  const terms = parseCaptionKeywords(input).sort((a, b) => b.length - a.length);
  if (!terms.length) return [];
  const patterns = terms.map((term) => term.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/\s+/gu, "\\s+"));
  const matcher = new RegExp("(?<![\\p{L}\\p{N}_])(?:" + patterns.join("|") + ")(?![\\p{L}\\p{N}_])", "giu");
  return Array.from(String(text).matchAll(matcher), (match) => ({ start: match.index, end: match.index + match[0].length }));
}

export function getCaptionLineRuns(lines, text, keywords) {
  const ranges = getCaptionKeywordRanges(text, keywords);
  let cursor = 0;
  return lines.map((line) => {
    const start = String(text).indexOf(line, cursor);
    if (start < 0) return [{ text: line, highlighted: false }];
    cursor = start + line.length;
    const runs = [];
    let offset = 0;
    for (const range of ranges) {
      const left = Math.max(0, range.start - start);
      const right = Math.min(line.length, range.end - start);
      if (right <= left) continue;
      if (left > offset) runs.push({ text: line.slice(offset, left), highlighted: false });
      runs.push({ text: line.slice(left, right), highlighted: true });
      offset = right;
    }
    if (offset < line.length) runs.push({ text: line.slice(offset), highlighted: false });
    return runs.length ? runs : [{ text: line, highlighted: false }];
  });
}

export function applyCaptionKeywords(segments, selectedId, keywords, color, all = false) {
  const terms = parseCaptionKeywords(keywords);
  const highlightColor = /^#[0-9a-f]{6}$/iu.test(color || "") ? color : DEFAULT_CAPTION_HIGHLIGHT_COLOR;
  return segments.map((segment) => all || segment.id === selectedId
    ? { ...segment, highlightWords: [...terms], highlightColor }
    : segment);
}
