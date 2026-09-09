import {parseKeywordSuggestions, validateCaptionTexts} from './captionKeywordAIContract.js';
import {keywordAIError, normalizeKeywordLanguage} from './captionKeywordAICopy.js';
export async function requestCaptionKeywordSuggestions(segments, {signal, language = 'pt'} = {}) {
  language = normalizeKeywordLanguage(language);
  const captions = validateCaptionTexts(Array.isArray(segments) ? segments.map(segment => segment?.text) : null, language);
  const headers = {'X-Timeline-Language': language};
  let session;
  try {
    session = await fetch('/api/caption-keywords/session', {signal, headers, cache: 'no-store'});
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw keywordAIError('connection', language);
  }
  if (!session.ok) throw keywordAIError('connection', language);
  let capability;
  try { ({capability} = await session.json()); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw keywordAIError('connection', language);
  }
  let response;
  try {
    response = await fetch('/api/caption-keywords', {method: 'POST', signal, headers: {...headers, 'Content-Type': 'application/json', 'X-Timeline-Capability': capability}, body: JSON.stringify({captions, language})});
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw keywordAIError('failed', language);
  }
  let result;
  try { result = await response.json(); }
  catch (error) {
    if (error.name === 'AbortError') throw error;
    throw keywordAIError('json', language);
  }
  if (!response.ok) throw keywordAIError(result?.code || 'failed', language, result?.values);
  return parseKeywordSuggestions(JSON.stringify(result), captions, language);
}

export {localizeCaptionKeywordError} from './captionKeywordAICopy.js';
