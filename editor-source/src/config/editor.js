import {
  ClosedCaptioning,
  ImageSquare,
  MusicNote,
  Scan,
} from "@phosphor-icons/react";

export { MODEL_ID, AUTOMATIC_CAPTION_MODEL_ID, AUTOMATIC_CAPTION_MODEL_LABEL } from "./models.js";

export const SAMPLE_IMAGE = "/me-ensina-ai.svg";
export const DEFAULT_TIMELINE_DURATION_SECONDS = 10;
export const MAX_TIMELINE_DURATION_SECONDS = 24 * 60 * 60;
export const IMAGE_SEGMENT_SECONDS = 2;
export const MIN_VISUAL_SEGMENT_SECONDS = 0.5;
export const MAX_IMAGE_THUMBNAILS = 80;
export const IMAGE_RESIZE_OVERFLOW_SECONDS_PER_PIXEL = 0.05;
export const IMAGE_SNAP_THRESHOLD_PIXELS = 16;
export const MIN_CAPTION_SEGMENT_SECONDS = 1.2;
export const MAX_CAPTION_SEGMENT_SECONDS = 12;
export const SUPPORTED_MEDIA_TYPES = ["image/", "video/", "audio/"];
export const ASSET_DRAG_MIME = "application/x-ai-voiceover-asset";
export const COMPACT_WORKSPACE_QUERY = "(max-width: 1279px)";

export const DEFAULT_SCRIPT = "";

const LEGACY_VOICE_ID_ALIASES = {
  zh_m_yansheng: "zh_f_ruoxi",
  zh_m_yunzhou: "zh_f_qinglan",
  zh_m_jingche: "zh_f_ruoxi",
};

export function normalizeVoiceId(voiceId) {
  return LEGACY_VOICE_ID_ALIASES[voiceId] || voiceId;
}

export const EXPORT_RECORDING_FORMATS = [
  {
    mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    extension: "mp4",
    label: "MP4",
  },
  {
    mimeType: "video/mp4;codecs=h264,aac",
    extension: "mp4",
    label: "MP4",
  },
  {
    mimeType: "video/mp4",
    extension: "mp4",
    label: "MP4",
  },
  {
    mimeType: "video/webm;codecs=vp9,opus",
    extension: "webm",
    label: "WebM",
  },
  {
    mimeType: "video/webm;codecs=vp8,opus",
    extension: "webm",
    label: "WebM",
  },
  {
    mimeType: "video/webm",
    extension: "webm",
    label: "WebM",
  },
];

export const AUDIO_RECORDING_FORMATS = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  { mimeType: "audio/mp4", extension: "m4a" },
];

export const VOICES = [
  {
    id: "zh_f_qinglan",
    name: "晴岚",
    displayName: "Qinglan",
    language: "中文",
    detail: "Hojo TTS Light 80M · 自然中英双语",
    gender: "自然女声",
    engine: "hojo",
    defaultSpeed: 1,
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "zh_f_ruoxi",
    name: "若溪",
    displayName: "Ruoxi",
    language: "中文",
    detail: "Hojo TTS Light 80M · 自然中英双语",
    gender: "自然女声",
    engine: "hojo",
    defaultSpeed: 1,
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "af_heart",
    name: "Heart",
    language: "English",
    detail: "Kokoro 82M · q8",
    gender: "Warm female",
    engine: "kokoro",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "am_fenrir",
    name: "Fenrir",
    language: "English",
    detail: "Kokoro 82M · q8",
    gender: "Steady male",
    engine: "kokoro",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "de_DE-thorsten-medium",
    name: "Thorsten",
    language: "Deutsch",
    detail: "Piper ONNX · Deutsch",
    gender: "Natural male",
    engine: "piper",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "es_ES-davefx-medium",
    name: "DaveFX",
    language: "Español",
    detail: "Piper ONNX · Español",
    gender: "Natural male",
    engine: "piper",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "fr_FR-siwis-medium",
    name: "Siwis",
    language: "Français",
    detail: "Piper ONNX · Français",
    gender: "Natural voice",
    engine: "piper",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "it_IT-riccardo-x_low",
    name: "Riccardo",
    language: "Italiano",
    detail: "Piper ONNX · Italiano · x_low",
    gender: "Natural female",
    engine: "piper",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "pt_BR-faber-medium",
    name: "Faber",
    language: "Português",
    detail: "Piper ONNX · Português (Brasil)",
    gender: "Natural male",
    engine: "piper",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "ko_KR-mms-medium",
    name: "Minseo",
    language: "한국어",
    detail: "MMS VITS ONNX · 한국어",
    gender: "Natural male",
    engine: "mms",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "ja_JP-supertonic-f1",
    name: "Hikari",
    language: "日本語",
    detail: "Supertonic 3 ONNX · 日本語",
    gender: "Natural female",
    engine: "supertonic",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "vi_VN-mms-medium",
    name: "Linh",
    language: "Tiếng Việt",
    detail: "MMS VITS ONNX · Tiếng Việt",
    gender: "Natural male",
    engine: "mms",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "ru_RU-mms-medium",
    name: "Irina",
    language: "Русский",
    detail: "MMS VITS ONNX · Русский",
    gender: "Natural male",
    engine: "mms",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
  {
    id: "th_TH-mms-medium",
    name: "Malee",
    language: "ไทย",
    detail: "MMS VITS ONNX · ภาษาไทย",
    gender: "Natural male",
    engine: "mms",
    badge: "ONNX",
    avatarUrl: "/me-ensina-ai.svg",
    sampleUrl: "",
  },
];

export const TOOL_RAIL = [
  { id: "media", label: "媒体", icon: ImageSquare },
  { id: "caption", label: "字幕", icon: ClosedCaptioning },
  { id: "smart", label: "智能", icon: Scan },
  { id: "audio", label: "音频", icon: MusicNote },
];

export const RATIO_OPTIONS = [
  { id: "16:9", label: "16:9", width: 1280, height: 720 },
  { id: "9:16", label: "9:16", width: 720, height: 1280 },
  { id: "1:1", label: "1:1", width: 1080, height: 1080 },
  { id: "4:5", label: "4:5", width: 1080, height: 1350 },
];

const BASIC_FILTER_OPTIONS = [
  { id: "none", name: "原片", css: "none" },
  { id: "cool", name: "冷调清透", css: "contrast(1.04) saturate(0.96) hue-rotate(8deg)" },
  { id: "film", name: "胶片暗角", css: "contrast(1.12) saturate(0.82) brightness(0.92)" },
  { id: "bright", name: "轻亮人像", css: "brightness(1.08) contrast(0.98) saturate(1.05)" },
];

export const EFFECT_OPTIONS = [
  { id: "effect-clean", name: "清晰增强", css: "contrast(1.08) saturate(1.08) brightness(1.03)" },
  { id: "effect-soft", name: "柔光", css: "brightness(1.08) contrast(0.94) saturate(1.06)" },
  { id: "effect-cinematic", name: "电影感", css: "contrast(1.18) saturate(0.86) brightness(0.92)" },
  { id: "effect-vivid", name: "高饱和", css: "contrast(1.08) saturate(1.28)" },
  { id: "effect-night", name: "夜景", css: "brightness(0.82) contrast(1.2) saturate(1.08)" },
  { id: "effect-warm", name: "暖调", css: "sepia(0.16) saturate(1.12) brightness(1.04)" },
  { id: "effect-cold", name: "冷蓝", css: "hue-rotate(12deg) saturate(0.98) contrast(1.06)" },
  { id: "effect-noir", name: "黑白", css: "grayscale(1) contrast(1.18)" },
  { id: "effect-dream", name: "梦幻", css: "brightness(1.1) saturate(1.18) blur(0.2px)" },
];

export const FILTER_OPTIONS = [...BASIC_FILTER_OPTIONS, ...EFFECT_OPTIONS];
export const VISUAL_STYLE_OPTIONS = FILTER_OPTIONS;

export const TRANSITIONS = [
  { id: "none", name: "无转场" },
  { id: "fade", name: "淡入淡出" },
  { id: "zoom", name: "轻推拉" },
  { id: "flash", name: "闪白切换" },
  { id: "wipe-left", name: "左推入" },
  { id: "wipe-up", name: "上推入" },
  { id: "blur", name: "模糊切" },
  { id: "split", name: "双开门" },
  { id: "glitch", name: "故障闪" },
];

export const STICKER_PAGE_SIZE = 9;
export const DEFAULT_STICKER_SEGMENT_SECONDS = 3;

export const STICKER_CATEGORIES = [
  { id: "all", name: "全部", nameEn: "All", kind: "stickerCategory" },
  { id: "trending", name: "热门", nameEn: "Hot", kind: "stickerCategory" },
  { id: "voice", name: "旁白", nameEn: "Voiceover", kind: "stickerCategory" },
  { id: "reaction", name: "互动", nameEn: "Reactions", kind: "stickerCategory" },
  { id: "commerce", name: "带货", nameEn: "Shop", kind: "stickerCategory" },
];

export const STICKER_LIBRARY = [
  { id: "trend-flame", name: "热度火焰", nameEn: "Hot Flame", category: "trending", src: "/me-ensina-ai.svg" },
  { id: "trend-spark", name: "闪光爆点", nameEn: "Spark Burst", category: "trending", src: "/me-ensina-ai.svg" },
  { id: "trend-bolt", name: "闪电强调", nameEn: "Lightning", category: "trending", src: "/me-ensina-ai.svg" },
  { id: "trend-starburst", name: "爆点星芒", nameEn: "Starburst", category: "trending", src: "/me-ensina-ai.svg" },
  { id: "trend-crown", name: "精选皇冠", nameEn: "Crown", category: "trending", src: "/me-ensina-ai.svg" },
  { id: "trend-megaphone", name: "扩音提醒", nameEn: "Megaphone", category: "trending", src: "/me-ensina-ai.svg" },
  { id: "trend-rocket", name: "起飞火箭", nameEn: "Rocket", category: "trending", src: "/me-ensina-ai.svg" },
  { id: "trend-confetti", name: "彩带庆祝", nameEn: "Confetti", category: "trending", src: "/me-ensina-ai.svg" },
  { id: "trend-verified", name: "认证勾选", nameEn: "Verified Check", category: "trending", src: "/me-ensina-ai.svg" },
  { id: "voice-mic", name: "录音麦克风", nameEn: "Studio Mic", category: "voice", src: "/me-ensina-ai.svg" },
  { id: "voice-waveform", name: "音频波形", nameEn: "Waveform", category: "voice", src: "/me-ensina-ai.svg" },
  { id: "voice-headphones", name: "监听耳机", nameEn: "Headphones", category: "voice", src: "/me-ensina-ai.svg" },
  { id: "voice-sound-ring", name: "声波圆环", nameEn: "Sound Ring", category: "voice", src: "/me-ensina-ai.svg" },
  { id: "voice-caption-card", name: "字幕卡片", nameEn: "Caption Card", category: "voice", src: "/me-ensina-ai.svg" },
  { id: "voice-music-note", name: "音乐音符", nameEn: "Music Note", category: "voice", src: "/me-ensina-ai.svg" },
  { id: "voice-speaker", name: "扬声器", nameEn: "Speaker", category: "voice", src: "/me-ensina-ai.svg" },
  { id: "voice-magic-wand", name: "魔法增强", nameEn: "Magic Wand", category: "voice", src: "/me-ensina-ai.svg" },
  { id: "voice-timeline-marker", name: "时间线标记", nameEn: "Timeline Marker", category: "voice", src: "/me-ensina-ai.svg" },
  { id: "react-heart", name: "爱心", nameEn: "Heart", category: "reaction", src: "/me-ensina-ai.svg" },
  { id: "react-like", name: "点赞", nameEn: "Like", category: "reaction", src: "/me-ensina-ai.svg" },
  { id: "react-smile", name: "微笑", nameEn: "Smile", category: "reaction", src: "/me-ensina-ai.svg" },
  { id: "react-surprise", name: "惊讶", nameEn: "Surprise", category: "reaction", src: "/me-ensina-ai.svg" },
  { id: "react-eyes", name: "亮眼", nameEn: "Bright Eyes", category: "reaction", src: "/me-ensina-ai.svg" },
  { id: "react-applause", name: "鼓掌", nameEn: "Applause", category: "reaction", src: "/me-ensina-ai.svg" },
  { id: "react-chat", name: "评论气泡", nameEn: "Chat Bubble", category: "reaction", src: "/me-ensina-ai.svg" },
  { id: "react-dots", name: "互动点点", nameEn: "Dot Bubble", category: "reaction", src: "/me-ensina-ai.svg" },
  { id: "react-alert", name: "重点提醒", nameEn: "Alert Burst", category: "reaction", src: "/me-ensina-ai.svg" },
  { id: "shop-gift", name: "礼盒", nameEn: "Gift", category: "commerce", src: "/me-ensina-ai.svg" },
  { id: "shop-bag", name: "购物袋", nameEn: "Shopping Bag", category: "commerce", src: "/me-ensina-ai.svg" },
  { id: "shop-tag", name: "价格标签", nameEn: "Blank Tag", category: "commerce", src: "/me-ensina-ai.svg" },
  { id: "shop-coins", name: "金币", nameEn: "Coins", category: "commerce", src: "/me-ensina-ai.svg" },
  { id: "shop-box", name: "产品盒", nameEn: "Product Box", category: "commerce", src: "/me-ensina-ai.svg" },
  { id: "shop-cart", name: "购物车", nameEn: "Cart", category: "commerce", src: "/me-ensina-ai.svg" },
  { id: "shop-camera", name: "相机", nameEn: "Camera", category: "commerce", src: "/me-ensina-ai.svg" },
  { id: "shop-idea", name: "灵感灯泡", nameEn: "Idea Bulb", category: "commerce", src: "/me-ensina-ai.svg" },
  { id: "shop-calendar", name: "日历", nameEn: "Calendar", category: "commerce", src: "/me-ensina-ai.svg" },
];

export const STICKERS = [
  { id: "none", name: "无贴纸", text: "" },
  ...STICKER_LIBRARY,
];

// Translate only controlled descriptive fields. IDs, names and source data stay intact.
const VOICE_METADATA_KEYS = {
  "中文": "voiceMetadataChinese", "日本語": "voiceMetadataJapanese",
  "English": "voiceMetadataEnglish", "Deutsch": "voiceMetadataGerman",
  "Español": "voiceMetadataSpanish", "Français": "voiceMetadataFrench",
  "Italiano": "voiceMetadataItalian", "Português": "voiceMetadataPortuguese",
  "Português (Brasil)": "voiceMetadataBrazilianPortuguese", "한국어": "voiceMetadataKorean",
  "Tiếng Việt": "voiceMetadataVietnamese", "Русский": "voiceMetadataRussian",
  "ไทย": "voiceMetadataThai", "ภาษาไทย": "voiceMetadataThai",
  "自然女声": "voiceMetadataNaturalFemale", "Natural female": "voiceMetadataNaturalFemale",
  "Natural male": "voiceMetadataNaturalMale", "Natural voice": "voiceMetadataNaturalVoice",
  "Warm female": "voiceMetadataWarmFemale", "Steady male": "voiceMetadataSteadyMale",
  "自然中英双语": "voiceMetadataChineseEnglish",
};

export function translateVoiceMetadata(value, t) {
  return String(value ?? "").split(" · ").map((part) => {
    const key = VOICE_METADATA_KEYS[part];
    return key ? t(key, part) : part;
  }).join(" · ");
}

/** Display aliases are catalog-only; customized records keep their own names. */
export function getVoiceDisplayName(voice) {
  const catalog = VOICES.find((item) => item.id === voice?.id && item.name === voice?.name);
  return catalog?.displayName || voice?.name || "";
}
