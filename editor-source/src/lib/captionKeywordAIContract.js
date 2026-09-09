import {keywordAIError} from './captionKeywordAICopy.js';
export const MAX_KEYWORD_COUNT = 10;
export function validateCaptionTexts(captions, language = 'pt') {
  if (!Array.isArray(captions) || !captions.length || captions.length > 100 || captions.some(text => typeof text !== 'string' || !text.trim())) {
    throw keywordAIError('captions', language);
  }
  if (captions.join('\n').length > 12000) throw keywordAIError('length', language);
  return captions;
}
export function parseKeywordSuggestions(output, captions, language = 'pt') {
  validateCaptionTexts(captions, language);
  let result;
  try { result = JSON.parse(output); } catch { throw keywordAIError('json', language); }
  if (!result || !Array.isArray(result.keywords) || result.keywords.length > MAX_KEYWORD_COUNT) throw keywordAIError('list', language);
  const keywords = result.keywords;
  if (keywords.some(word => typeof word !== 'string' || !word.trim() || word !== word.trim() || word.length > 60 || word.split(/\s+/u).length > 4)) throw keywordAIError('terms', language);
  for (const word of keywords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const literal = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'u');
    if (!captions.some(text => literal.test(text))) throw keywordAIError('literal', language, {word});
  }
  return [...new Set(keywords)];
}
