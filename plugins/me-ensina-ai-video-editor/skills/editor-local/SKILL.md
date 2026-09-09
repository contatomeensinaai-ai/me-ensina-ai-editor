---
name: editor-local
description: Prepare, abra e opere o editor local Me Ensina AI quando o usuário pedir para abrir o editor ou editar vídeos, legendas e imagens com este plugin.
---
# Me Ensina AI — Editor de Vídeo 2.0

Piloto para macOS Apple Silicon, macOS Intel e Windows x64. Não exige que o usuário encontre ou instale o comando Codex no Terminal para abrir o editor. Este plugin oferece skill e inicializador; não declara MCP de edição da timeline.

## Ambiente de execução

Confirme o sistema do host: macOS arm64/x64 ou Windows x64. Linux, Windows ARM, WSL e containers Cowork não são suportados. Não instale um runtime de outro sistema.

Esta skill atende Codex e Claude Code locais. No Claude Code, permita abrir o navegador padrão. Os botões Codex não passam a usar a conta Claude automaticamente.

No Codex, use `--no-open` no Mac ou `-NoOpen` no Windows e abra a URL retornada no navegador interno disponível. Reutilize a aba existente sem recarregar uma edição. Se não houver ferramenta de navegador, explique a limitação e abra no navegador padrão quando autorizado.

## Preparação e abertura

1. A partir deste SKILL.md, resolva `../../launcher/open-editor.command` no Mac ou `../../launcher/open-editor.ps1` no Windows dentro da mesma raiz do plugin. Leia o script e seus auxiliares antes da primeira execução.
2. Ao pedido de abrir o editor, informe que a primeira preparação baixa bibliotecas públicas e pode levar alguns minutos; nenhum modelo de IA é baixado por essa preparação. No Mac, execute `/bin/bash` com o caminho absoluto do launcher. No Windows, execute `powershell.exe -NoProfile -File "<caminho absoluto do launcher>"`, acrescentando `-NoOpen` no Codex. Não altere ExecutionPolicy global nem use bypass; se uma política bloquear, explique o erro concreto. Siga a orientação de navegador acima. Mantenha a pessoa informada durante a preparação e leia o resultado. Não peça ao usuário para procurar binários, executar comandos ou fazer login novamente sem um diagnóstico concreto.
3. O launcher valida plataforma, pacote e dependências; reutiliza o editor aberto ou prepara uma versão isolada. Não substitua nem encerre outro serviço na porta. Nunca invoque o antigo Instalar.command 0.1.0.
4. Confirme `/api/health` na URL retornada e a abertura no navegador disponível no ambiente. Reutilize a aba existente. Não recarregue nem feche abas durante uma edição. Abrir a página comprova abertura, não todas as funções.
5. Falha na CLI do Codex não impede edição manual. `codexAvailable` indica apenas executável, nunca login confirmado. Se faltar CLI, faça análises autorizadas nesta conversa e aplique pela interface quando ferramentas de navegador estiverem disponíveis; explique se um botão específico exigir CLI. Não instale outra conta ou copie autenticação.

## Edição

Inspecione a timeline antes de mudar. Exporte `.timeline` antes de substituir projetos. Use somente ferramentas de navegador documentadas e controles visíveis. Sem ferramenta de operação disponível, abra o editor e diga a limitação; não invente uma edição.

Use a transcrição para cortes e imagens de apoio. Preserve IDs, sincronização e fala. Gere imagens apenas quando solicitado; revise a imagem e os tempos, aplique na prévia e confira o vídeo final. Legendas locais requerem download de modelo autorizado. Palavras e imagens pelos botões Codex usam internet e a conta do próprio usuário; nenhuma credencial vem no pacote.

Antes de concluir exportação, confirme arquivo, áudio, duração e imagem. Recursos experimentais e qualidade de IA não são garantidos. Não publique conteúdos sem pedido explícito. Nunca envie dados pessoais em issues públicas.

Dados ficam em `~/Library/Application Support/Me Ensina AI` no Mac ou `%LOCALAPPDATA%\Me Ensina AI` no Windows. Preserve essa pasta e a origem do navegador. O launcher e README do repositório documentam recuperação. No Windows use disco local NTFS; caminhos de rede/UNC não são suportados. A compatibilidade do runtime não garante todos os modelos experimentais ou codecs em qualquer hardware.
