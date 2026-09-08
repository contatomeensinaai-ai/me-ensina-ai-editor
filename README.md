# Me Ensina AI Editor

Editor local de vídeo com plugin para Codex. **Versão pública piloto para Mac com chip Apple Silicon (M1 ou mais recente).** Intel e Windows ainda não homologados.

## Instalar no Claude Code

Este repositório também contém `.claude-plugin/marketplace.json`, o formato exigido pelo Claude. Adicione o mesmo link na tela de marketplaces do Claude e instale **me-ensina-ai-editor**. Se a tentativa anterior falhou por manifesto ausente, tente adicionar novamente; se já estiver listado, atualize o marketplace.

Depois, no **Claude Code executando localmente no Mac**, peça: **Abra o editor Me Ensina AI**. A skill também pode ser chamada por `/me-ensina-ai-editor:editor-local`.

O formato do marketplace/plugin foi validado pela CLI Claude. Isso não significa homologação do fluxo completo no Claude Desktop/Cowork: o launcher requer macOS Apple Silicon e não roda dentro de um container Linux. Os botões de IA específicos do Codex ainda dependem de uma instalação e conta Codex; não são convertidos em recursos Claude por instalar este plugin.

## Instalar pelo Codex

No Codex, abra **Plugins**, escolha a opção de adicionar/importar um **marketplace** e informe este repositório:

**https://github.com/contatomeensinaai-ai/me-ensina-ai-editor**

No marketplace **Me Ensina AI**, instale **Me Ensina AI Editor**. Abra uma conversa nova e peça:

> Abra o editor Me Ensina AI e me ajude a editar um vídeo.

O Codex usa a skill para preparar e abrir o editor. No primeiro uso há download de bibliotecas e uma compilação local; nas próximas aberturas a instalação é reutilizada. Não é necessário Homebrew nem executar o antigo Instalar.command. O plugin não é parte do catálogo oficial da OpenAI; a fonte é este marketplace público. A disponibilidade da importação depende da versão e das políticas do seu Codex.

Se preferir, envie este link numa conversa do Codex e peça para instalar o marketplace. A assistência deve verificar os comandos disponíveis na instalação, sem solicitar senhas ou copiar sua autenticação.

## O que está disponível

Importação, timeline, cortes, filtros, máscaras geométricas, legendas, destaque de palavras, imagens de apoio, salvamento e exportação. Os fluxos foram testados no Mac de desenvolvimento; esta versão serve para validar instalação e uso em outros Macs.

- Abrir o editor não depende da CLI do Codex.
- Os botões de análise e geração pelo Codex dependem de uma CLI compatível e da própria conta. O inicializador procura instalações existentes; não instala nem autentica outra conta.
- Modelos locais exigem downloads separados, iniciados pelo usuário. Música, voz, restauração e segmentação continuam experimentais.
- Pré-amostras de voz, retratos e mídias demonstrativas da base não acompanham a distribuição pública. O modelo de segmentação de pessoa também não é incluído. Esses recursos não devem ser apresentados como homologados.
- A operação automática da interface requer ferramentas de navegador disponíveis no Codex. Este plugin não inclui um servidor MCP de edição da timeline.

## Privacidade e dados

Vídeos e projetos ficam na máquina. A preparação baixa código e bibliotecas de GitHub e npm; não envia vídeos. Funções Codex acionadas pelo usuário enviam os insumos necessários à sua conta, pela internet. Isso consome os limites aplicáveis à conta.

Pasta local: `~/Library/Application Support/Me Ensina AI`. Não a apague para atualizar. Exporte seu projeto `.timeline` antes de atualizar e use sempre a mesma origem do navegador para recuperação.

## Desenvolvimento

O fonte da interface está em `editor-source/`; servidor em `runtime/`; catálogo em `.agents/plugins/marketplace.json`; skill em `plugins/me-ensina-ai-editor`.

Para registrar via CLI compatível, opcionalmente:

```sh
codex plugin marketplace add https://github.com/contatomeensinaai-ai/me-ensina-ai-editor
codex plugin add me-ensina-ai-editor@me-ensina-ai
```

A release contém Node/npm oficiais e fonte. `setup-editor.mjs` verifica hashes dos arquivos vendor de uma revisão fixa do upstream, executa `npm ci --ignore-scripts` com lockfile e compila a interface. Bibliotecas de terceiros são obtidas diretamente das fontes originais na máquina de destino; a release não contém FFmpeg/libav compilados, modelos ou amostras de voz. Não rode esse setup em uma pasta compartilhada com conteúdo não confiável.

## Créditos e licenças

Versão adaptada pela Me Ensina AI a partir de [Timeline Studio / ai-video-editor](https://github.com/MartinDelophy/ai-video-editor), de MartinDelophy. A licença MIT original está preservada em LICENSE. Componentes e modelos de terceiros têm licenças próprias, descritas em [THIRD_PARTY.md](THIRD_PARTY.md). O código aberto não transfere direitos sobre modelos, vozes ou mídias de terceiros.

Consulte também a [documentação oficial de plugins](https://learn.chatgpt.com/docs/plugins). Não publique credenciais, vídeos privados ou projetos com informações pessoais nas issues.
