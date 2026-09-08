# Bootstrap portátil do plugin

Entrega de Victor para Carlos Eduardo. Gate: revisão e integração por Carlos antes de publicação. Arquivos próprios: `launcher/open-editor.command`, `launcher/start-editor.mjs`, `launcher-tests/launcher.test.mjs`, este relatório. `launcher/release.json` pertence ao integrador e deve ficar adjacente aos dois scripts dentro do plugin instalado.

## Comportamento

- macOS Apple Silicon, somente pasta do usuário; nenhum sudo ou instalação de Codex.
- Reutiliza editor saudável já ativo em `http://127.0.0.1:5201` sem reiniciar, abrir, fechar ou navegar sua aba. Porta ocupada por outro serviço não é liberada à força.
- Reutiliza pacote em `MEAI_PACKAGE_DIR` ou `MEAI_DATA_DIR/current`; caso contrário obtém a release GitHub fixada no manifesto. `MEAI_DATA_DIR` padrão: `~/Library/Application Support/Me Ensina AI`.
- Valida SHA-256 antes de extrair ou executar. Rejeita travessia de diretórios e symlinks no ZIP. Instala em `releases/<version>-<prefixo SHA>`, sem sobrescrever releases incompletas. Lock impede extração simultânea da mesma release.
- Release precisa de `bin/node`, `runtime/server.mjs` e `editor/dist/index.html` **ou** `setup-editor.mjs` na raiz. Sem dist, executa `bin/node setup-editor.mjs`, sem shell, herdando ambiente; exige índice produzido antes de iniciar runtime. Lock protege preparo concorrente.
- Abre editor sem CLI. Descoberta opcional: `MEAI_CODEX_BIN` absoluto, PATH absoluto e Resources de aplicativos Codex/variantes em `/Applications` e `~/Applications`. Não confunde executável da interface gráfica com CLI. Não procura autenticação ou segredos.
- Runtime usa Node embarcado, processo separado com log local `logs/launcher-runtime.log`. IA continua dependendo de CLI compatível e conta; encontrar executável não valida login ou inferência.
- `--no-open` evita abertura automática de navegador; apropriado para skill que controla a abertura no Codex. Sem a flag, abre navegador padrão apenas após iniciar novo servidor.

## Contrato do manifesto

Chaves JSON: `version`, `url`, `sha256`, `packageDirectory`. URL HTTPS de asset ZIP em caminho GitHub releases/download; SHA-256 hexadecimal minúsculo de 64 caracteres. Dados aprovados pelo integrador: repositório `contatomeensinaai-ai/me-ensina-ai-editor`, tag `v0.1.1-pilot`, asset `Me-Ensina-AI-Mac-Apple-Silicon-0.1.1.zip`, diretório raiz `Me-Ensina-AI-Mac-Apple-Silicon-0.1.1`. Não use SHA provisório para publicar.

## Validação executada

```sh
work/me-ensina-ai-mac-pilot/bin/node --test work/me-ensina-ai-public/launcher-tests/launcher.test.mjs
/bin/bash -n work/me-ensina-ai-public/launcher/open-editor.command
```

**9 testes passaram no Node 22.23.2 embarcado.** Testam descoberta por PATH/variantes, GUI não confundida com CLI, abertura sem CLI, reutilização sem mutação, porta estrangeira preservada, setup só quando necessário, falha/ausência de saída e concorrência de setup, health de outro app rejeitado, validação nativa do manifesto e rejeição de SHA/caminhos/URLs inválidos. Casos de startup usam subprocesso injetado e diretórios sintéticos; não são prova de instalação no segundo Mac. Validação do manifesto usa `/bin/bash` e `/usr/bin/plutil` reais, sem rede.

## Integração pelo responsável

1. Copiar os dois arquivos de launcher para a pasta `launcher` do plugin, preservar modo executável do `.command` e adicionar manifesto final.
2. Pacote não deve conter symlinks. Para npm, preferir `lib/node_modules/npm/bin/npm-cli.js` no setup ou cópia regular do alvo.
3. Rodar `/bin/bash <plugin>/launcher/open-editor.command --validate-release` após preencher SHA.
4. Após revisão, skill executa `/bin/bash <plugin>/launcher/open-editor.command --no-open` e usa URL retornada.
5. Validar release/setup real numa instalação limpa no outro Mac antes de afirmar aceite ponta a ponta.

## Limites honestos

Não houve download da nova release, execução do setup real, chamada IA, leitura de autenticação, instalação no outro Mac, alteração da aba ou servidor atual, nem publicação. Dependências/vendor obtidos pelo setup são responsabilidade do script e pins do integrador; os testes deste bootstrap não validam licenças ou todos os pacotes transitivos. Primeira preparação depende de internet e pode levar minutos. Cancelamento abrupto pode deixar lock; não removemos lock automaticamente sem verificar se há preparo em andamento. O bootstrap não instala serviço de login. Binário declarado por override ou release já instalada é uma entrada local confiada pelo usuário, não uma nova verificação criptográfica completa de todos os arquivos.
