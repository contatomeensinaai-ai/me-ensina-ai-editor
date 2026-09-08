import { useEffect, useRef, useState } from "react";
import { applyCaptionKeywords, DEFAULT_CAPTION_HIGHLIGHT_COLOR } from "../lib/captionHighlights.js";
import "./CaptionKeywordsPanel.css";
import { localizeCaptionKeywordError, requestCaptionKeywordSuggestions } from "../lib/captionKeywordAI.js";

export function CaptionKeywordsPanel({ selectedCaptionSegment, captionSegments, setCaptionSegments, t, language = "en" }) {
  const [keywords, setKeywords] = useState(() => (selectedCaptionSegment?.highlightWords || []).join(", "));
  const [color, setColor] = useState(() => selectedCaptionSegment?.highlightColor || DEFAULT_CAPTION_HIGHLIGHT_COLOR);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const suggest = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setStatus({ key: "captionKeywordsAnalyzing" });
    try {
      const words = await requestCaptionKeywordSuggestions(captionSegments, { signal: controller.signal, language });
      if (!controller.signal.aborted) {
        setKeywords(words.join(", "));
        setStatus({ key: words.length ? "captionKeywordsReady" : "captionKeywordsEmpty" });
      }
    } catch (error) {
      if (!controller.signal.aborted) setStatus({ error, key: "captionKeywordsFailed" });
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };
  const cancel = () => {
    request.current?.abort();
    setStatus({ key: "captionKeywordsCanceled" });
  };
  const apply = (all) => setCaptionSegments((segments) => applyCaptionKeywords(
    segments, selectedCaptionSegment?.id, keywords, color, all,
  ));
  return (
    <section className="caption-keywords-panel" aria-label={t("captionKeywordsTitle")}>
      <strong>{t("captionKeywordsTitle")}</strong>
      <p>{t("captionKeywordsHint")}</p>
      <p>{t("captionKeywordsAccountHint")}</p>
      <div className="caption-keywords-actions">
        <button type="button" disabled={busy || !captionSegments.length} onClick={suggest}>{t("captionKeywordsSuggest")}</button>
        {busy && <button type="button" onClick={cancel}>{t("captionKeywordsCancel")}</button>}
      </div>
      <p role="status" aria-live="polite">{status ? (status.error ? localizeCaptionKeywordError(status.error, language) : t(status.key)) : ""}</p>
      <label>
        {t("captionKeywordsLabel")}
        <textarea
          rows={2}
          disabled={busy}
          value={keywords}
          placeholder={t("captionKeywordsPlaceholder")}
          onChange={(event) => setKeywords(event.target.value)}
        />
      </label>
      <label className="caption-keywords-color">
        {t("captionKeywordsColor")}
        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
      </label>
      <div className="caption-keywords-actions">
        <button type="button" disabled={!selectedCaptionSegment?.id} onClick={() => apply(false)}>{t("captionKeywordsApplyCurrent")}</button>
        <button type="button" disabled={!captionSegments.length} onClick={() => apply(true)}>{t("captionKeywordsApplyAll")}</button>
      </div>
      <small>{t("captionKeywordsClearHint")}</small>
    </section>
  );
}
