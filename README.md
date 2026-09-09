# Me Ensina AI — Editor de Vídeo 2.0

Editor local de vídeo com plugin para Codex. **Plugin 2.1.0, runtime piloto 0.2.0: Mac Apple Silicon, Mac Intel e Windows x64.** A validação por plataforma está no relatório de compatibilidade; funções experimentais não estão homologadas.

## Arquivo para instalar no Claude

Se preferir a opção **Enviar/Upload de plugin**, baixe **Me-Ensina-AI-Editor-de-Video-2.1.0-Claude.zip** na [release atual](https://github.com/contatomeensinaai-ai/me-ensina-ai-editor/releases/tag/v0.2.0-pilot). Este é o ZIP do plugin, diferente do pacote de preparação do editor.

Marketplace exclusivo: `me-ensina-ai-video-2`. Plugin: `me-ensina-ai-video-editor`. Os manifestos internos continuam com os nomes exigidos pelo Claude.

## Nome e atualização

O plugin agora se chama **Me Ensina AI — Editor de Vídeo 2.0**, com identificador `me-ensina-ai-video-editor`, para distinguir de plugins anteriores. Atualize o marketplace e instale o novo identificador. O plugin antigo não é removido automaticamente. A versão 2.1.0 adiciona preparação nativa por sistema, com runtime 0.2.0 e hashes específicos para cada arquitetura.

## Instalar no Claude Code

Este repositório também contém `.claude-plugin/marketplace.json`, o formato exigido pelo Claude. Adicione o mesmo link na tela de marketplaces do Claude e instale **me-ensina-ai-video-editor**. Se a tentativa anterior falhou por manifesto ausente, tente adicionar novamente; se já estiver listado, atualize o marketplace.

Depois, no **Claude Code executando localmente no Mac ou Windows x64**, peça: **Abra o editor Me Ensina AI**. A skill também pode ser chamada por `/me-ensina-ai-video-editor:editor-local`.

O formato do marketplace/plugin foi validado pela CLI Claude. Isso não significa homologação do fluxo completo no Claude Desktop/Cowork: o launcher requer Mac ou Windows x64 locais e não roda dentro de um container Linux. Os botões de IA específicos do Codex ainda dependem de uma instalação e conta Codex; não são convertidos em recursos Claude por instalar este plugin.

## Instalar pelo Codex

Use o [marketplace exclusivo do Codex](https://github.com/contatomeensinaai-ai/me-ensina-ai-codex), instale **me-ensina-ai-video-codex** e abra uma conversa nova:

> Abra o editor Me Ensina AI e me ajude a editar um vídeo.

O plugin identifica o sistema e baixa o pacote correspondente. Não precisa instalar Node, npm ou Homebrew manualmente. A primeira preparação exige internet. As próximas aberturas reutilizam a instalação. Não use o ZIP do Claude no Codex.

## O que está disponível

Importação, timeline, cortes, filtros, máscaras geométricas, legendas, destaque de palavras, imagens de apoio, salvamento e exportação. Os fluxos foram testados no Mac de desenvolvimento; os testes de instalação nativa e build são executados também no GitHub Actions. O teste visual completo depende do navegador e do hardware de destino.

- Abrir o editor não depende da CLI do Codex.
- Os botões de análise e geração pelo Codex dependem de uma CLI compatível e da própria conta. O inicializador procura instalações existentes; não instala nem autentica outra conta.
- Modelos locais exigem downloads separados, iniciados pelo usuário. Música, voz, restauração e segmentação continuam experimentais.
- Pré-amostras de voz, retratos e mídias demonstrativas da base não acompanham a distribuição pública. O modelo de segmentação de pessoa também não é incluído. Esses recursos não devem ser apresentados como homologados.
- A operação automática da interface requer ferramentas de navegador disponíveis no Codex. Este plugin não inclui um servidor MCP de edição da timeline.

## Privacidade e dados

Vídeos e projetos ficam na máquina. A preparação baixa código e bibliotecas de GitHub e npm; não envia vídeos. Funções Codex acionadas pelo usuário enviam os insumos necessários à sua conta, pela internet. Isso consome os limites aplicáveis à conta.

Pasta local no Mac: `~/Library/Application Support/Me Ensina AI`; no Windows: `%LOCALAPPDATA%\Me Ensina AI`. Windows requer disco local com hard links, como NTFS; UNC não é suportado. Não a apague para atualizar. Exporte seu projeto `.timeline` antes de atualizar e use sempre a mesma origem do navegador para recuperação.

## Desenvolvimento

O fonte da interface está em `editor-source/`; servidor em `runtime/`; catálogo em `.agents/plugins/marketplace.json`; skill em `plugins/me-ensina-ai-video-editor`.

Para registrar via CLI compatível, opcionalmente:

```sh
codex plugin marketplace add https://github.com/contatomeensinaai-ai/me-ensina-ai-codex
codex plugin add me-ensina-ai-video-codex@me-ensina-ai-codex
```

A release contém Node/npm oficiais e fonte. `setup-editor.mjs` verifica hashes dos arquivos vendor de uma revisão fixa do upstream, executa `npm ci --ignore-scripts` com lockfile e compila a interface. Bibliotecas de terceiros são obtidas diretamente das fontes originais na máquina de destino; a release não contém FFmpeg/libav compilados, modelos ou amostras de voz. Não rode esse setup em uma pasta compartilhada com conteúdo não confiável.

## Créditos e licenças

Versão adaptada pela Me Ensina AI a partir de [Timeline Studio / ai-video-editor](https://github.com/MartinDelophy/ai-video-editor), de MartinDelophy. A licença MIT original está preservada em LICENSE. Componentes e modelos de terceiros têm licenças próprias, descritas em [THIRD_PARTY.md](THIRD_PARTY.md). O código aberto não transfere direitos sobre modelos, vozes ou mídias de terceiros.

Consulte também a [documentação oficial de plugins](https://learn.chatgpt.com/docs/plugins). Não publique credenciais, vídeos privados ou projetos com informações pessoais nas issues.
