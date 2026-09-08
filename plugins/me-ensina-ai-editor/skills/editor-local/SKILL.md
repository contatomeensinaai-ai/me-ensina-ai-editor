---
name: editor-local
description: Prepare, abra e opere o editor local Me Ensina AI quando o usuário pedir para abrir o editor ou editar vídeos, legendas e imagens com este plugin.
---
# Me Ensina AI Editor

Piloto para macOS Apple Silicon. Não exige que o usuário encontre ou instale o comando Codex no Terminal para abrir o editor. Este plugin oferece skill e inicializador; não declara MCP de edição da timeline.

## Ambiente de execução

Esta skill é compartilhada por Codex e Claude Code. Antes de executar o launcher, confirme que os comandos rodam no próprio macOS Apple Silicon do usuário. Se estiver em Linux, container, sessão remota ou sandbox do Cowork sem acesso ao host macOS, explique que esta versão requer execução local no Mac. Não tente instalar o runtime macOS no container e não afirme que importar o marketplace garante compatibilidade de execução.

No Claude Code local, execute o launcher sem `--no-open` para abrir no navegador padrão, salvo quando houver controle de navegador disponível e preferível. No Codex, use `--no-open` e abra no navegador interno. Nunca presuma que o Claude oferece as ferramentas internas do Codex. A ausência de CLI Codex não impede abrir o editor; os botões explicitamente ligados ao Codex continuam dependendo dela e não passam a usar a conta Claude automaticamente.

## Preparação e abertura

1. A partir deste SKILL.md, resolva `../../launcher/open-editor.command` dentro da mesma raiz do plugin. Leia o script e seus auxiliares antes da primeira execução.
2. Ao pedido de abrir o editor, informe que a primeira preparação baixa bibliotecas públicas e pode levar alguns minutos; nenhum modelo de IA é baixado por essa preparação. Execute `/bin/bash` com o caminho absoluto do launcher, seguindo a orientação de navegador do ambiente acima. Mantenha a pessoa informada durante a preparação e leia o resultado. Não peça ao usuário para procurar binários, executar comandos ou fazer login novamente sem um diagnóstico concreto.
3. O launcher valida plataforma, pacote e dependências; reutiliza o editor aberto ou prepara uma versão isolada. Não substitua nem encerre outro serviço na porta. Nunca invoque o antigo Instalar.command 0.1.0.
4. Confirme `/api/health` na URL retornada e a abertura no navegador disponível no ambiente. Reutilize a aba existente. Não recarregue nem feche abas durante uma edição. Abrir a página comprova abertura, não todas as funções.
5. Falha na CLI do Codex não impede edição manual. `codexAvailable` indica apenas executável, nunca login confirmado. Se faltar CLI, faça análises autorizadas nesta conversa e aplique pela interface quando ferramentas de navegador estiverem disponíveis; explique se um botão específico exigir CLI. Não instale outra conta ou copie autenticação.

## Edição

Inspecione a timeline antes de mudar. Exporte `.timeline` antes de substituir projetos. Use somente ferramentas de navegador documentadas e controles visíveis. Sem ferramenta de operação disponível, abra o editor e diga a limitação; não invente uma edição.

Use a transcrição para cortes e imagens de apoio. Preserve IDs, sincronização e fala. Gere imagens apenas quando solicitado; revise a imagem e os tempos, aplique na prévia e confira o vídeo final. Legendas locais requerem download de modelo autorizado. Palavras e imagens pelos botões Codex usam internet e a conta do próprio usuário; nenhuma credencial vem no pacote.

Antes de concluir exportação, confirme arquivo, áudio, duração e imagem. Recursos experimentais e qualidade de IA não são garantidos. Não publique conteúdos sem pedido explícito. Nunca envie dados pessoais em issues públicas.

Dados ficam em `~/Library/Application Support/Me Ensina AI`. Preserve essa pasta e a origem do navegador. O launcher e README do repositório documentam recuperação. Intel e Windows não homologados.
