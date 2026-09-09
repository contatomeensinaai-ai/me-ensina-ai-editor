# Localização da interface pt/en/es

Escopo: código do editor; nenhum servidor, aba, projeto do usuário ou distribuição foi alterado por esta execução. Integração e publicação ficam com Carlos Eduardo após revisão.

## Causas confirmadas

- Toasts tinham tradução central, mas vários painéis renderizavam diretamente mensagens de progresso/erro de hooks e workers.
- Havia mensagens sem tradução e erros compostos com prefixo traduzido e causa chinesa.
- O catálogo permitia idiomas além dos três aprovados. Preferência antiga `zh` podia selecionar chinês novamente.
- Metadados de voz e nomes de duas vozes internas apareciam em chinês. Novos áudios também herdavam esse nome.
- O teste de cobertura referia um baseline ausente no checkout público. Templates concorrentes de inserção/apêndice capturavam tipos internos como texto livre.

## Implementação

- `src/i18nRuntimeAdditional.js`: 162 entradas explícitas em português, inglês e espanhol (486 traduções), incluindo duas revisões dos templates de mídia.
- `src/i18nMessageRuntime.js`: dicionários e expressões compilados uma vez por idioma, preservação literal de argumentos e tradução recursiva somente de slots internos enumerados. Tipos `图片`/`视频` possuem mapeamento exclusivo nos três templates de mídia; nomes livres são preservados.
- `src/i18n.js`: interface limitada a pt/en/es; preferência antiga incompatível reabre a escolha sem apagar o projeto. Tradutor expõe `message` para mensagens de runtime.
- Hooks de avatar, importação/exportação de projeto, restauração, reparo e redução de ruído mantêm a causa localizada ao compor erros.
- Painéis de profundidade, efeitos, plugins, parallax, tracking, SmartFrame, voz e overlays traduzem os status no momento da renderização, acompanhando troca de idioma.
- `config/editor.js`, `panels.jsx`, `VoicePanel.jsx`: 19 chaves de metadados; nomes de exibição Qinglan/Ruoxi para catálogo interno, seletores, favoritos e histórico. IDs, registros, nomes personalizados e arquivos antigos preservados.
- `useVoiceGeneration.js`: somente o label de novos áudios gerados usa o nome de exibição. Síntese e modelo permanecem inalterados.
- `docs/runtime-i18n-baseline.json` restaurado; `docs/runtime-i18n-current-corpus.json` documenta 464 mensagens de interface extraídas da fonte, com referências.

## Verificação

64 testes passaram, zero falhas ou skips, usando Node embarcado 22.23.2 e dependências já existentes. O checkout público não recebeu instalação de dependências. Comando equivalente após setup:

```sh
node --test src/i18n*.test.js src/components/i18nVisibleLabels.test.js src/hooks/useToast.test.js src/hooks/useProjectFiles.test.js src/hooks/useVoiceGenerationLocalization.test.js
```

Reproduções antes da correção: os três testes de inserção exibiram caracteres chineses; seis testes de label de geração produziram o nome original do catálogo. Após correção, todos passaram.

Os testes cobrem os três idiomas, mensagens aninhadas, placeholders especiais, tipos internos, preservação de nomes e transcrições do usuário, troca de idioma dos avisos, renderização de componentes, importação atômica e falha real do caminho de salvamento com a função de tradução de produção. A geração de áudio usa uma saída sintética apenas para testar o contrato de label; não executa inferência.

## Limites e próximo responsável

Esta entrega comprova contratos de módulos e renderização de componentes com um host mínimo de React; não comprova todos os fluxos de interface em navegador nem todos os modelos. Não houve inferência, novos downloads, build servido ou publicação nesta execução. Carlos informou build em staging aprovado, mas o snapshot com os últimos refinamentos deve passar pela integração final dele.

Conteúdo do usuário, nomes de arquivos e perfis personalizados, modelos técnicos, licenças, créditos e textos destinados à síntese são preservados. Mensagens desconhecidas de terceiros permanecem literais para conservar o diagnóstico, em vez de serem ocultadas por mensagem genérica. O corpus é uma cobertura delimitada, não prova de inexistência de qualquer texto futuro não catalogado.
