# Compatibilidade Mac e Windows 0.2.0

Handoff de Victor para Carlos Eduardo. Implementação local concluída; gate de publicação e testes nativos remotos pertence ao integrador. Não houve alteração do servidor 5201 ou abas do usuário.

## Mudanças entregues

- `launcher/open-editor.command`: detecta Apple Silicon ou Intel e lê `platforms.darwin-arm64` / `platforms.darwin-x64` do novo `releases.json`. Download HTTPS, SHA fixo, rejeição de links/travessia, instalação por versão/arquitetura/hash, lock, reaproveitamento de servidor existente.
- `launcher/open-editor.ps1`: equivalente Windows x64 com .NET, sem administrador e sem alterar política de execução. Download mantém HTTPS em cada redirecionamento; verifica SHA antes da extração. Valida todas as entradas ZIP antes de escrever, recusando travessia, ADS, dispositivos reservados, nomes ambíguos, duplicatas sem distinção de caixa, links e volume descompactado acima de 2 GB. Usa criação exclusiva para lock/arquivos e move a pasta preparada sem sobrescrever destino.
- `launcher/platform.mjs` e `runtime/platform.mjs`: auxiliares portáteis idênticos, pois launcher instalado no plugin precede download e runtime da release funciona separado dele. Caminhos locais de drive Windows; LocalAppData, `node.exe`, PATH com `;`, executáveis nativos `codex.exe` opcionais. Sem executar `.cmd`/shell para localizar CLI. A abertura opcional do navegador Windows usa `rundll32.exe` absoluto com argumentos fixos e URL loopback validada.
- `launcher/start-editor.mjs`: usa Node embarcado da plataforma; inicia editor mesmo sem Codex; prepara dist somente quando ausente; não mata servidor ou navega aba existente. Comparação do ponto de entrada suporta letras de drive com caixa diferente.
- `setup-editor.mjs`: PATH da plataforma e ponto de entrada Windows corrigidos; permanecem npm CLI JavaScript via Node, `npm ci --ignore-scripts --no-audit --no-fund` e vendor com SHA fixo.
- `runtime/runtime-config.mjs`: pasta de dados LocalAppData no Windows e Application Support no Mac; resolve caminhos reais tolerando caixa/drive do Windows, sem aceitar redirecionamento para outra pasta. Ambiente de CLI preserva apenas variáveis necessárias do sistema e caminhos da conta; não lê credenciais.
- `runtime/server.mjs`: conserva Host/Origin/capabilities e loopback; protege caminhos especiais Windows/ADS, junctions e symlinks. MIME, HEAD e Range mantidos.
- `runtime/server/local-artifacts.mjs`: arquivo continua sincronizado e relido para conferir SHA antes da publicação exclusiva por hard link. Windows omite apenas fsync de diretório, que não é suportado por essa API. Isso não equivale a garantia de durabilidade de diretório em queda de energia. Não usa rename que sobrescreva destino como fallback.
- `runtime/server/supporting-image-generation.mjs`: confere pasta real imediata do PNG dentro da sessão com comparação apropriada para drive/caixa, mantendo fronteira do threadId.
- `runtime/src/lib/localArtifactSave.js` e `editor-source/src/lib/localArtifactSave.js`: recibo verificado aceita caminho absoluto POSIX ou drive Windows com nome final correspondente. Relativos, UNC, travessia e nome divergente continuam recusados.
- Testes: `tests/runtime.test.mjs`, `launcher-tests/launcher.test.mjs`, `launcher-tests/platform.test.mjs`, `launcher-tests/windows-launcher.test.ps1`, `editor-source/src/lib/localArtifactSave.test.js`.

## Evidência executada neste Mac

Node embarcado v22.23.2:

```sh
node --test launcher-tests/*.test.mjs editor-source/src/lib/localArtifactSave.test.js
node --test tests/runtime.test.mjs
/bin/bash -n launcher/open-editor.command
```

- **16 testes de launcher, caminhos e cliente passaram.** Incluem casos de drive Windows usando `path.win32`; não são prova de kernel Windows.
- **6 testes HTTP reais passaram** em porta loopback efêmera. Conferidos HTML, WASM MIME, bytes Range, recusa de travessia e symlink, Host/Origin, sessões com capabilities distintas, SRT salvo/reaberto e hash/recibo. A inferência Codex é substituída por função sintética nesse teste de transporte, explicitamente sem avaliar qualidade de IA.
- Sintaxe Bash aprovada. Manifesto Mac validado via plutil nativo em fixtures; nenhum asset foi baixado por estes testes.
- A primeira tentativa HTTP foi bloqueada pelo sandbox com `listen EPERM`; repetição autorizada em porta efêmera passou. Nenhum servidor existente foi modificado.

## Verificação Windows a executar pelo integrador

```powershell
node --test launcher-tests/*.test.mjs editor-source/src/lib/localArtifactSave.test.js tests/runtime.test.mjs
powershell -NoProfile -File launcher-tests/windows-launcher.test.ps1
```

PowerShell testa manifesto, extração com bytes reais e 15 assertivas, incluindo ZIP inseguro/symlink. Não faz download nem inicia subprocesso ou navegador. No Windows, teste HTTP usa junction de diretório para verificar fuga sem privilégio de symlink de arquivo; o cenário de symlink de arquivo fica indicado como não exercitado quando exige privilégio adicional.

Ainda pendentes neste handoff: execução nativa Windows, build com setup no Windows/Intel, primeiro download das novas releases públicas, teste de abertura pela skill no outro computador e browser/MP4 nativo. Não declarar esses aceites a partir dos testes de `path.win32`.

## Contrato e limites operacionais

Manifesto adjacente ao launcher: `releases.json`, com `version: "0.2.0"` e `platforms` contendo `darwin-arm64`, `darwin-x64`, `win32-x64`; cada um possui URL GitHub, SHA-256 minúsculo e `packageDirectory`. Preenchimento e sincronização com plugin pertencem a Carlos. O `release.json` antigo não é consumido por esta versão.

Release uniforme: `bin/node` ou `bin/node.exe`, `lib/node_modules/npm/bin/npm-cli.js`, `runtime/`, `editor-source/`, `setup-editor.mjs`, vendor manifesto e metadados controlados pelo empacotador. Nenhum Codex adicional é instalado. IA exige CLI nativa compatível e login do próprio usuário; descoberta de arquivo não prova login. Instalações Codex em pastas incomuns podem precisar de `MEAI_CODEX_BIN` absoluto apontando para executável de CLI real. Não há suporte Windows ARM nesta entrega.

Exportação Windows pressupõe volume local que suporte hard links, como NTFS. Se o volume não suportar, o salvamento falha explicitamente; não relaxa atomicidade para aparentar sucesso. UNC/rede não é destino suportado. Um preparo encerrado abruptamente pode deixar lock e exige conferir processo antes de limpar; não removemos locks cegamente. Não há mudança global de ExecutionPolicy, serviço de login, privilégio administrador ou fechamento automático do editor.

## Correção após primeira execução CI nativa

O run 34295158471 falhou antes dos testes funcionais porque os imports usavam `runtime/src/lib`, uma cópia apenas local. Além disso, `.gitignore` com regra `lib/` excluía também `editor-source/src/lib` inteiro. Trocar ordem de setup/testes não resolveria: setup não copiava aqueles helpers.

Correção de engenharia: todos os imports do runtime e teste de caminhos agora usam diretamente `editor-source/src/lib` canônico. O helper canônico contém a correção Windows e seu teste. Novo `launcher-tests/source-contract.test.mjs` cria uma árvore isolada sem runtime/src e sem npm, copia somente os três helpers canônicos necessários e importa o módulo HTTP real com outro processo Node: passou. Os 6 testes HTTP passaram novamente após essa troca. O diretório runtime/src antigo não é mais dependência e pode ser excluído do pacote pelo integrador.

Ação do integrador: restringir `.gitignore` a `/lib/`, revisar e versionar os arquivos fonte revelados; atualizar plugin/cópias e rodar novamente a CI. Ordem suficiente: preparar bundle Node/npm do runner; testes Node e PowerShell sintéticos sem rede; setup-editor (vendor/npm/build); testes de smoke/browser quando autorizados. Os testes básicos não precisam do setup depois que a fonte canônica está versionada.
