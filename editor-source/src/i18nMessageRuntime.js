import { RUNTIME_REVIEWED_COPY } from "./i18nRuntimeReviewed.js";
import { RUNTIME_ADDITIONAL_COPY } from "./i18nRuntimeAdditional.js";
import { UI_MESSAGE_COPY } from "./i18nMessages.js";

const templateCache = new Map();
const copyCache = new Map();
const PLACEHOLDER = /\{(\d+|count)\}/g;
// Only these arguments are internal UI statuses. Other slots may contain user
// filenames, media names, model names or verbatim diagnostic details.
const SYSTEM_ARGUMENTS = {
  "帧 {0}/{1} · {2}": ["2"],
  "逐帧描边 {0}/{1} · {2}": ["2"],
  "全视频 {0}/{1} · {2}": ["2"],
  "稀疏检测 {0} · {1}": ["1"],
  "{0}素材已{1}到图片轨": ["1"],
  "{0} {1} 转写字幕": ["0"],
  "SlimSAM 模型 · {0} · {1}%": ["0"],
};
const INSERTED_MEDIA_TYPES = {
  pt: { "图片": "Imagem", "视频": "Vídeo" },
  en: { "图片": "Image", "视频": "Video" },
  es: { "图片": "Imagen", "视频": "Vídeo" },
};
function getCopy(language) {
  if (!copyCache.has(language)) copyCache.set(language, {
    ...(UI_MESSAGE_COPY[language] ?? UI_MESSAGE_COPY.en ?? {}),
    ...(RUNTIME_REVIEWED_COPY[language] ?? {}),
    ...(RUNTIME_ADDITIONAL_COPY[language] ?? {}),
  });
  return copyCache.get(language);
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function compileTemplates(language) {
  if (templateCache.has(language)) return templateCache.get(language);
  const entries = Object.entries(getCopy(language))
    .filter(([source]) => /\{(?:\d+|count)\}/.test(source))
    .map(([source, translated]) => {
      const placeholders = [...source.matchAll(PLACEHOLDER)].map((match) => match[1]);
      const pattern = source.split(/\{(?:\d+|count)\}/g).map(escapeRegex).join("([\\s\\S]*?)");
      return { source, literalLength: source.replace(PLACEHOLDER, "").length, placeholders, regex: new RegExp(`^${pattern}$`), translated };
    })
    .sort((left, right) => right.literalLength - left.literalLength);
  templateCache.set(language, entries);
  return entries;
}
export function localizeUiMessage(message, language) {
  const text = String(message ?? "");
  const copy = getCopy(language);
  if (Object.hasOwn(copy, text)) return copy[text];
  for (const entry of compileTemplates(language)) {
    const match = text.match(entry.regex);
    if (!match) continue;
    const values = Object.fromEntries(entry.placeholders.map((placeholder, index) => {
      const value = match[index + 1] ?? "";
      if (["{0}素材已{1}到图片轨", "{0}素材已追加到图片轨", "{0}素材已应用到预览和时间线"].includes(entry.source) && placeholder === "0") {
        return [placeholder, INSERTED_MEDIA_TYPES[language]?.[value] ?? value];
      }
      return [placeholder, SYSTEM_ARGUMENTS[entry.source]?.includes(placeholder)
        ? localizeUiMessage(value, language) : value];
    }));
    return entry.translated.replace(PLACEHOLDER, (_, key) => values[key] ?? `{${key}}`);
  }
  return text;
}

/** Localize only the explicitly supplied system failure, never media fields. */
export function formatUiFailure(t, titleKey, error) {
  const detail = error instanceof Error ? error.message : String(error ?? "");
  return `${t(titleKey)}: ${t.message?.(detail) ?? detail}`;
}
