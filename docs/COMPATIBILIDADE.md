# Compatibilidade da distribuição 2.1.0

Runtime 0.2.0. Pacotes separados para Mac Apple Silicon, Mac Intel e Windows x64, selecionados automaticamente pelo plugin.

## Evidência

Execução nativa [34295609824](https://github.com/contatomeensinaai-ai/me-ensina-ai-editor/actions/runs/34295609824): Windows e macOS concluíram com sucesso.

A verificação nativa está no [GitHub Actions](https://github.com/contatomeensinaai-ai/me-ensina-ai-editor/actions/workflows/platforms.yml): testes de caminhos e inicialização, servidor HTTP real, proteção de arquivos, preparação das dependências e build da interface. Windows também executa testes do extrator em PowerShell 5.

No Mac Apple Silicon local, o Node do ZIP final carregou o servidor e seus módulos sem dependências externas. Os três ZIPs foram inspecionados: hashes conferidos, bibliotecas canônicas presentes, sem runtime/src residual, modelos, mídia de amostra ou WASM compilado.

## Limites do aceite

Esses testes não demonstram todos os botões, codecs ou modelos de IA funcionando em todo computador. O fluxo visual completo de importar, salvar, reabrir e exportar MP4 com áudio ainda depende da execução do teste de navegador. Mac Intel tem pacote oficial próprio; a validação em hardware Intel permanece pendente.

Windows suportado nesta distribuição: x64, pasta local, volume com hard links como NTFS. Windows ARM, Linux, WSL, pastas de rede UNC e containers Cowork não são suportados. Políticas corporativas podem impedir PowerShell; o plugin não usa bypass nem muda a política global.

Não há chaves ou contas no pacote. Abrir o editor não exige CLI Codex, mas os botões Codex exigem executável compatível e login do próprio aluno. Voz, música, restauração e segmentação permanecem experimentais.

## Atualização

Atualize o marketplace correspondente ao aplicativo e instale a versão 2.1.0. No Codex use o repositório me-ensina-ai-codex. No Claude use me-ensina-ai-editor. Abra uma conversa nova e peça para abrir o editor. A atualização não encerra uma edição já aberta; preserve o projeto antes de trocar de versão.
