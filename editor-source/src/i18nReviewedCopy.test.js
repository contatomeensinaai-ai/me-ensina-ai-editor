import test from 'node:test';
import assert from 'node:assert/strict';
import { I18N_COMPLETION_COPY } from './i18nCompletion.js';
import { I18N_REVIEWED_COPY } from './i18nReviewedCopy.js';
import { createTranslator } from './i18n.js';
const placeholders = (value) => [...String(value).matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
const translate = (language, key) => createTranslator(language)(key);
test('Portuguese and Spanish completions preserve English interpolation variables', () => {
  const en = createTranslator('en');
  const errors = [];
  for (const language of ['pt', 'es']) {
    for (const [key, value] of Object.entries(I18N_COMPLETION_COPY[language])) {
      if (JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(en(key)))) errors.push(`${language}.${key}`);
    }
  }
  assert.deepEqual(errors, []);
});
test('progress labels render actual counts, filenames and elapsed seconds', () => {
  for (const language of ['pt', 'en', 'es']) {
    const progress = translate(language, 'avatarProgressFrameEncoded').replace('{current}', '3').replace('{total}', '12').replace('{seconds}', '4');
    assert.match(progress, /3\/12/);
    assert.match(progress, /4s/);
    assert.doesNotMatch(progress, /\{[^}]+\}/);
    assert.match(translate(language, 'avatarProgressDownloadFile').replace('{file}', 'model.onnx'), /model\.onnx/);
  }
});
test('editor actions distinguish fading in from out and use correct caption terminology', () => {
  assert.equal(translate('pt', 'fadeIn'), 'Entrada gradual');
  assert.equal(translate('pt', 'fadeOut'), 'Saída gradual');
  assert.equal(translate('pt', 'audioReverseRestored'), 'Áudio restaurado para reprodução normal');
  assert.equal(translate('es', 'captionBackground'), 'Fondo');
  assert.equal(translate('es', 'currentCaption'), 'Subtítulo actual');
  assert.equal(translate('es', 'fit'), 'Ajustar');
  assert.equal(translate('es', 'use'), 'Usar');
});
test('reviewed copy has complete languages, preserves tokens and contains no Chinese UI fallback', () => {
  assert.ok(Object.keys(I18N_REVIEWED_COPY.en).length > 40);
  const keys = Object.keys(I18N_REVIEWED_COPY.en).sort();
  for (const language of ['pt', 'en', 'es']) {
    assert.deepEqual(Object.keys(I18N_REVIEWED_COPY[language]).sort(), keys);
    for (const key of keys) {
      const value = I18N_REVIEWED_COPY[language][key];
      assert.equal(typeof value, 'string');
      assert.doesNotMatch(value, /[\u3400-\u9fff]/);
      assert.deepEqual(placeholders(value), placeholders(I18N_REVIEWED_COPY.en[key]), `${language}.${key}`);
    }
  }
});
test('advanced tools and voice workflow do not fall back to English', () => {
  for (const language of ['pt', 'es']) {
    for (const key of ['moreTools', 'cloneConsent', 'effectFlowRun', 'ttsErrorSilentWaveform', 'exportVisualRequired']) {
      assert.notEqual(translate(language, key), translate('en', key), `${language}.${key}`);
    }
  }
});
