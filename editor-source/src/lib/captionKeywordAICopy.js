const messages = {
  captions: ['Envie de 1 a 100 legendas com texto.', 'Send between 1 and 100 captions containing text.', 'Envía entre 1 y 100 subtítulos con texto.'],
  length: ['As legendas excedem o limite de 12.000 caracteres por análise.', 'Captions exceed the 12,000-character limit per analysis.', 'Los subtítulos superan el límite de 12.000 caracteres por análisis.'],
  json: ['O Codex retornou JSON inválido. Tente novamente ou escolha as palavras manualmente.', 'Codex returned invalid JSON. Try again or choose words manually.', 'Codex devolvió JSON inválido. Inténtalo de nuevo o elige las palabras manualmente.'],
  list: ['O Codex deve retornar uma lista com até 10 palavras ou expressões.', 'Codex must return a list of up to 10 words or expressions.', 'Codex debe devolver una lista de hasta 10 palabras o expresiones.'],
  terms: ['A sugestão contém palavras ou expressões inválidas.', 'The suggestion contains invalid words or expressions.', 'La sugerencia contiene palabras o expresiones inválidas.'],
  literal: ['A sugestão “{word}” não existe literalmente nas legendas. Nada foi aplicado.', 'The suggestion “{word}” does not appear literally in the captions. Nothing was applied.', 'La sugerencia “{word}” no aparece literalmente en los subtítulos. No se aplicó nada.'],
  connection: ['A conexão local com o Codex não está disponível nesta versão.', 'The local Codex connection is unavailable in this version.', 'La conexión local con Codex no está disponible en esta versión.'],
  failed: ['Não foi possível obter sugestões do Codex.', 'Could not get suggestions from Codex.', 'No se pudieron obtener sugerencias de Codex.'],
  cancel: ['Análise cancelada.', 'Analysis canceled.', 'Análisis cancelado.'],
  timeout: ['O Codex excedeu 2 minutos. Tente novamente.', 'Codex exceeded 2 minutes. Try again.', 'Codex superó los 2 minutos. Inténtalo de nuevo.'],
  start: ['Não foi possível iniciar o Codex local. Verifique a instalação e o login.', 'Could not start local Codex. Check the installation and sign-in.', 'No se pudo iniciar Codex local. Comprueba la instalación y el inicio de sesión.'],
  incomplete: ['O Codex não concluiu a análise. Verifique o login ou o limite da conta.', 'Codex did not complete the analysis. Check your sign-in or account limit.', 'Codex no completó el análisis. Comprueba el inicio de sesión o el límite de la cuenta.'],
  origin: ['Origem não autorizada.', 'Unauthorized origin.', 'Origen no autorizado.'],
  route: ['Rota não encontrada.', 'Route not found.', 'Ruta no encontrada.'],
  session: ['Sessão local inválida. Atualize esta versão de teste.', 'Invalid local session. Reload this test version.', 'Sesión local inválida. Recarga esta versión de prueba.'],
  format: ['Formato de solicitação inválido.', 'Invalid request format.', 'Formato de solicitud inválido.'],
  active: ['Uma análise já está em andamento. Aguarde ou cancele.', 'An analysis is already in progress. Wait or cancel it.', 'Ya hay un análisis en curso. Espera o cancélalo.'],
  size: ['Solicitação muito grande.', 'Request is too large.', 'La solicitud es demasiado grande.'],
  rate: ['Aguarde dois segundos antes de tentar novamente.', 'Wait two seconds before trying again.', 'Espera dos segundos antes de volver a intentarlo.'],
  requestJson: ['Solicitação JSON inválida.', 'Invalid JSON request.', 'Solicitud JSON inválida.'],
};
export function normalizeKeywordLanguage(language = 'pt') {
  const base = typeof language === 'string' ? language.toLowerCase().split(/[-_]/)[0] : 'pt';
  return ['pt', 'en', 'es'].includes(base) ? base : 'pt';
}
export function keywordAICopy(key, language = 'pt', values = {}) {
  const message = (messages[key] || messages.failed)[['pt', 'en', 'es'].indexOf(normalizeKeywordLanguage(language))];
  return message.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
}
export function keywordAIError(key, language, values) {
  const error = new Error(keywordAICopy(key, language, values));
  error.keywordError = true;
  error.code = key;
  error.values = values;
  return error;
}

export function localizeCaptionKeywordError(error, language) {
  return error?.code ? keywordAICopy(error.code, language, error.values) : keywordAICopy("failed", language);
}
