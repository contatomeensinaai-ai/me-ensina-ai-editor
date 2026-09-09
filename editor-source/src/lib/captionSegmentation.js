import { makeId } from "./timeline.js";

export const PORTRAIT_CAPTION_PROFILE = Object.freeze({
  maxWords: 6,
  maxCharacters: 38,
  maxSeconds: 3,
  pauseSeconds: 0.45,
});

function joinWords(words, language) {
  const noWordSpaces = ["zh", "ja", "th"].includes(language);
  return words.reduce((text, word) => {
    const separator = !text || noWordSpaces || /^[,.;:!?%\)\]。！？、…]/u.test(word.text) ? "" : " ";
    return text + separator + word.text;
  }, "");
}

function alignmentError() {
  const error = new Error("O reconhecimento não forneceu alinhamento válido por palavra. Gere as legendas novamente com timestamps por palavra; os tempos não serão estimados.");
  error.code = "CAPTION_WORD_ALIGNMENT_REQUIRED";
  return error;
}

// Only actual word boundaries may create a caption boundary. Phrase timestamps
// cannot be apportioned by character count or average speaking speed.
export function groupTimedCaptionWords(output, {
  duration,
  timelineOffset = 0,
  language = "pt",
  profile = PORTRAIT_CAPTION_PROFILE,
} = {}) {
  const chunks = Array.isArray(output?.chunks) ? output.chunks : [];
  const words = [];
  for (const chunk of chunks) {
    const text = String(chunk.text ?? "").trim();
    if (!text) continue;
    const [start, end] = Array.isArray(chunk.timestamp) ? chunk.timestamp : [];
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start
      || (Number.isFinite(duration) && end > duration + 0.05)
      || (words.length && start + timelineOffset < words.at(-1).end - 0.000001)
      || (!/[\u3400-\u9fff\u3040-\u30ff\u0e00-\u0e7f]/u.test(text) && /\s/u.test(text))) {
      throw alignmentError();
    }
    words.push({ text, start: start + timelineOffset, end: end + timelineOffset });
  }
  if (!words.length) throw alignmentError();

  const segments = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const start = current[0].start;
    const end = current.at(-1).end;
    if (!(end > start)) throw alignmentError();
    segments.push({
      id: makeId("caption"), text: joinWords(current, language), start, end,
      hidden: false, source: "asr", timing: "word", words: current,
    });
    current = [];
  };

  for (const word of words) {
    const candidate = [...current, word];
    const isPunctuation = /^[\p{P}\p{S}]+$/u.test(word.text);
    const wouldOverflow = candidate.length > profile.maxWords
      || joinWords(candidate, language).length > profile.maxCharacters
      || (current.length && word.end - current[0].start > profile.maxSeconds);
    const pause = current.length && word.start - current.at(-1).end >= profile.pauseSeconds;
    if (current.length && !isPunctuation && (wouldOverflow || pause)) flush();
    current.push(word);
    if (/[.!?。！？]$/u.test(word.text)) flush();
  }
  flush();
  return segments;
}
