# Localização da interface 2.1.1

Patch do runtime 0.2.1, preparado em 8 de setembro de 2026 (America/New_York).

## Mudanças

A entrada e as configurações oferecem Português, English e Español. Preferências legadas fora desses idiomas reabrem a escolha, sem apagar o projeto.

Erros e progresso dos painéis passam pela tradução da interface. O corpus revisado reúne 464 mensagens com seus locais de origem. Foram acrescentadas 162 traduções por idioma, além das descrições controladas das vozes. A mudança de idioma é refletida na renderização dos avisos dos painéis.

Qinglan e Ruoxi são os nomes legíveis das duas vozes do catálogo antes exibidas em caracteres chineses. Identificadores e registros originais permanecem estáveis. Nomes personalizados, legendas, arquivos, modelos e créditos não são alterados.

Mensagens compostas conservam o detalhe do erro e os valores interpolados. A tradução reconhece apenas mensagens do sistema e tipos de mídia controlados, sem eliminar caracteres de conteúdo do usuário.

## Validação local

- 93 testes passaram: i18n, componentes de localização e todos os testes existentes dos hooks.
- 20 testes passaram: runtime HTTP, inicializador e caminhos de plataforma.
- Build Vite concluído; dependências existentes e arquivos vendor conferidos por SHA-256, sem download de modelos.
- Navegação e troca de Português, English e Español conferidas no navegador interno em origem de teste separada.
- Revisão independente encontrou uma mensagem de importação parcialmente chinesa. Correção e regressão específica para imagem/vídeo incluídas antes do empacotamento.

## Limites

A auditoria das mensagens não equivale a executar todos os modelos de IA. Textos livres, conteúdo de usuário e erros desconhecidos de fornecedores não são apagados nem substituídos por falhas genéricas. Mensagens adicionais de dependências podem exigir novos mapeamentos.

Voz, música, restauração e segmentação continuam experimentais. A compatibilidade de cada fluxo com hardware de destino segue o relatório de compatibilidade. Animações Hyperframes, Remotion e Motion não foram integradas por este patch.
