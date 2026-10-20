# Nexus Sales Intelligence na VPS AlmaLinux 9

Dominio: **https://sales.nexusfibra.net.br**.

## O que muda

O modo desktop continua usando IndexedDB. O build Docker usa `VITE_DATA_MODE=server`, exige login e compartilha a base no PostgreSQL. Planilhas continuam disponiveis: sao lidas no navegador, enviadas a API autenticada e classificadas novamente no servidor. Alterar o mes e uma escolha de cada usuario, sem substituir o painel dos outros.

Arquitetura: Traefik existente -> web Nginx -> API Node 24 -> PostgreSQL existente. A API consulta a Hubsoft; o navegador nunca recebe credenciais ou tokens Hubsoft. Nao ha novo container de PostgreSQL nem Electron no servidor.

## Banco de dados

Usamos o banco `lab` existente, em `lab-postgres`, no schema exclusivo `nexus_sales_intelligence`. A migracao cria:

| Tabela               | Finalidade                                                                   |
| -------------------- | ---------------------------------------------------------------------------- |
| schema_migrations    | Historico e checksum das migracoes                                           |
| users                | Contas individuais, todas com as mesmas permissoes; senhas com scrypt e salt |
| user_sessions        | Hash dos tokens de sessao, com expiracao de 8 horas                          |
| source_records       | Atendimentos e OS normalizados, identificados por protocolo/numero de OS     |
| commercial_records   | Eventos derivados e registros processados, separados por tipo e data         |
| import_runs          | Historico de importacoes por planilha                                        |
| sync_runs            | Historico, resultado e limites das consultas Hubsoft                         |
| sync_cursors         | Checkpoint de cada dia e fluxo de consulta                                   |
| application_settings | Qualidade da base e correspondencia de IDs de usuarios Hubsoft               |

As tabelas surgem ao executar a migracao, nao apenas ao construir imagens. O schema `nexus_tasks` e os dados dos outros projetos nao sao alterados. A conta PostgreSQL precisa poder criar o schema e suas tabelas. Para menor privilegio, pode-se fornecer uma conta propria com acesso somente a este schema.

**Portas:** `5433` e a porta do host da VPS para o PostgreSQL do laboratorio. Entre containers, a API usa `lab-postgres:5432` na rede Docker existente. O banco nao sera exposto publicamente por este projeto.

## Antes de publicar no GitHub (Windows, terminal local)

Na branch `feat/vps-hubsoft-integration`:

```powershell
cd 'C:\Users\supor\Documents\Nexus Sales Intelligence'
npm.cmd ci --ignore-scripts
npm.cmd ci --prefix server --ignore-scripts
npm.cmd run test:server
npm.cmd run lint
$env:VITE_DATA_MODE='server'
npm.cmd run build
Remove-Item Env:VITE_DATA_MODE

git status --short
git diff --stat
```

Revise os arquivos. `.env` e `.env.vps` NAO devem aparecer como arquivos para commit. Os exemplos `.env.example` e `.env.vps.example` podem ser versionados. Nao use `git add -f` para arquivos de ambiente.

```powershell
git add AGENTS.md .gitignore .dockerignore .env.example .env.vps.example Dockerfile compose.vps.yml deploy server database .github/workflows/server.yml package.json vite.config.ts vite.server.config.ts src
git diff --cached --stat
git commit -m "Adiciona backend, integracao Hubsoft de leitura e deploy Docker"
git push -u origin feat/vps-hubsoft-integration
```

Abra o pull request para `main`, revise e efetue o merge antes de continuar na VPS. Este procedimento nao faz deploy automatico por GitHub Actions; o workflow apenas valida build e testes.

## 1. Preparar a pasta na VPS

No terminal SSH (`lab@vps...`), nao no PowerShell do Windows:

```bash
mkdir -p /home/lab/projetos
cd /home/lab/projetos
git -c credential.helper= clone https://github.com/CarlosRobertoCruz/nexus-sales-intelligence.git
cd /home/lab/projetos/nexus-sales-intelligence
git switch main
git -c credential.helper= pull --ff-only origin main
git log -1 --oneline
ls compose.vps.yml server/index.mjs database/migrations/001_initial.sql
```

Se a pasta ja foi clonada, entre nela, execute `git status --short` e somente continue o pull se nao houver alteracoes locais de codigo pendentes.

Repositorio privado via HTTPS: informe seu usuario GitHub e, no prompt Password do GitHub, seu token de acesso autorizado ao repositorio. **Nao e a senha da VPS.** Nunca coloque o token na URL. Se usar PAT classic, ele precisa de escopo `repo`; politicas do proprietario/organizacao e SSO podem exigir autorizacao adicional. A passphrase da chave SSH, quando pedida para entrar na VPS, e outra credencial independente.

## 2. Conferir redes, memoria e dominio

```bash
docker network inspect n8n-traefik_app_network --format '{{.Name}}'
docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' lab-postgres
free -h
df -h /
```

Confirme a rede do banco e ajuste `DATABASE_NETWORK` se for diferente de `lab_network`. As redes sao externas e precisam existir. O Traefik existente usa `websecure` e resolver `le`. Crie o registro DNS A de `sales.nexusfibra.net.br` para o IP publico da VPS; se houver AAAA, ele tambem precisa apontar corretamente. A emissao TLS fica a cargo do Traefik existente.

A VPS tem outros projetos e pouca RAM: construa os servicos sequencialmente. Nao pare o Traefik, o PostgreSQL nem os demais projetos.

## 3. Configurar os arquivos privados

Na VPS:

```bash
cd /home/lab/projetos/nexus-sales-intelligence
umask 077
cp .env.vps.example .env.vps
nano .env.vps
```

Configure `DATABASE_URL` com a senha correta do PostgreSQL, codificando caracteres especiais para URL. Mantenha `APP_ORIGIN=https://sales.nexusfibra.net.br`, sem barra final, e o mesmo dominio em `SALES_DOMAIN`. Prefira valores entre aspas simples nos arquivos de ambiente quando houver `$`, para evitar interpolacao pelo Compose. Nao use `source .env`.

O `.env` com as credenciais Hubsoft existe somente no seu computador; nao vem pelo Git. Transfira-o pelo SSH, sem colar as credenciais no chat ou em comandos. No PowerShell **local**, depois de a pasta remota existir:

```powershell
cd 'C:\Users\supor\Documents\Nexus Sales Intelligence'
scp .env vps-lab:/home/lab/projetos/nexus-sales-intelligence/.env
```

De volta a VPS:

```bash
chmod 600 .env .env.vps
```

`HUBSOFT_API_URL` deve conter somente a origem HTTPS real da API (sem `/oauth/token`, sem `/api/v1/integracao`, sem usuario/senha na URL). Os outros quatro campos sao os informados pela Hubsoft. Nao publique a saida de comandos que exibam variaveis ou configuracoes resolvidas.

## 4. Construir as imagens e criar as tabelas

Defina esta funcao novamente sempre que abrir um terminal novo, dentro da pasta do projeto:

```bash
cd /home/lab/projetos/nexus-sales-intelligence
dc() { docker compose --env-file .env.vps -f compose.vps.yml "$@"; }
dc config --quiet
```

Execute **um comando por vez**, esperando terminar sem erro:

```bash
dc build api
```

```bash
dc build web
```

```bash
dc run --rm --no-deps migrate
```

A ultima etapa deve informar `ok 001_initial.sql` e `Migracoes prontas no schema nexus_sales_intelligence.` Reexecutar nao duplica tabelas nem apaga registros. Nao avance se qualquer comando falhar.

## 5. Criar os 3 ou 4 usuarios

No Bash da VPS, leia a senha de forma oculta (minimo 12 caracteres):

```bash
read -r -p 'Email: ' INITIAL_USER_EMAIL
read -r -p 'Nome: ' INITIAL_USER_NAME
read -r -s -p 'Senha inicial (minimo 12 caracteres): ' INITIAL_USER_PASSWORD
printf '\n'
export INITIAL_USER_EMAIL INITIAL_USER_NAME INITIAL_USER_PASSWORD

dc run --rm --no-deps \
  -e INITIAL_USER_EMAIL -e INITIAL_USER_NAME -e INITIAL_USER_PASSWORD \
  migrate node server/user.mjs

unset INITIAL_USER_EMAIL INITIAL_USER_NAME INITIAL_USER_PASSWORD
```

Repita para cada pessoa com e-mail diferente. Nao existe conta/senha padrao nem cadastro publico. Todos possuem as mesmas permissoes. Senhas nao sao armazenadas em texto puro.

## 6. Subir e verificar

```bash
dc up -d --no-build --wait api web
dc ps
curl --fail http://127.0.0.1:8089/healthz
curl --fail http://127.0.0.1:8089/api/ready
curl --fail -I https://sales.nexusfibra.net.br
```

Abra a URL HTTPS e entre com uma das contas criadas. Confirme o acesso em tela pequena, os seletores de mes e os PDFs/mapas. Tiles dos mapas dependem do servico externo OpenStreetMap e de conectividade do navegador.

Nao se espera ver dados antigos do IndexedDB automaticamente: importe as planilhas novamente ou consulte os dias autorizados na Hubsoft. A base passa a ser compartilhada, mas dados locais antigos nao sao apagados do desktop.

## 7. Primeira consulta Hubsoft e mapeamento

No painel, use **Hubsoft - consulta por dia**. Escolha **um unico dia conhecido**, de baixo volume. Clique em `Consultar / continuar`. Cada execucao processa ate **4 paginas GET no total**, com ate **50 registros por pagina** e intervalo minimo de **1 segundo** entre chamadas. A autenticacao OAuth, quando necessaria, e uma chamada POST adicional exclusivamente em `/oauth/token`; o token e reutilizado ate perto da expiracao.

Ha quatro fluxos sequenciais para esse mesmo dia: abertura e ultima alteracao de atendimentos; agendamento e termino executado de OS. Isso permite atualizar registros antigos movimentados no dia sem varrer meses de historico. A API publica documenta esses filtros em https://docs.hubsoft.com.br/ .

Quando houver mais paginas, a execucao pausa e salva o checkpoint. Clique novamente para continuar. Nenhuma consulta de dias seguintes comeca automaticamente. A opcao de reiniciar um dia consulta novamente a partir da primeira pagina, mediante confirmacao; use-a para atualizar um dia ainda em movimento. Nao inicie varreduras de varios dias.

O endpoint de atendimentos pode retornar apenas `id_usuario_abertura`, sem nome. Nessa situacao, cadastre a correspondencia com o ID real informado pelo administrador da Hubsoft (o ID abaixo e apenas exemplo):

```bash
dc run --rm --no-deps migrate node server/map-user.mjs 87 Beatriz
```

Esse e um mapeamento LOCAL, no nosso PostgreSQL; nao altera a Hubsoft. Repita para as atendentes necessarias. Nao use o usuario responsavel pelo atendimento como substituto do usuario que o abriu. O classificador preserva os planos e vendedores conhecidos do projeto original.

Se aparecer erro de campos insuficientes, a pagina nao avanca e o painel anterior e preservado. Confira as permissoes da integracao, o mapeamento dos usuarios e a estrutura retornada. O adaptador foi testado com exemplos simulados, mas **a compatibilidade com sua instancia real ainda precisa ser validada**, sem expor respostas com dados pessoais ou tokens.

Os indicadores sao publicados apenas quando todos os fluxos do dia terminam e ha atendimentos e OS suficientes para classificar. Uma venda exige atendimento anterior e OS finalizada; importar apenas o dia da OS pode nao trazer o atendimento antigo. Nesse caso, importe as planilhas historicas ou consulte o dia de abertura correspondente de forma pontual, e valide os numeros contra o relatorio conhecido antes de uso operacional.

A consulta tem timeout de 25 segundos por chamada, limite de resposta, nenhuma repeticao automatica em loop e pausa em 429. O servidor respeita `Retry-After`/`retry_after`. Nao existe agendamento automatico nesta versao. Ha limite conservador de **50 mil registros de origem na base**; ao atingir, a transacao e recusada, sem truncar silenciosamente.

## 8. Atualizacoes e backup

Antes de atualizar um ambiente ja em uso:

```bash
cd /home/lab/projetos/nexus-sales-intelligence
umask 077
mkdir -p backups
chmod 700 backups
docker exec lab-postgres pg_dump -U lab -d lab -n nexus_sales_intelligence -Fc > "backups/sales-$(date +%Y%m%d-%H%M%S).dump"
```

So continue se `pg_dump` terminar sem erro e o arquivo nao estiver vazio. Mantenha uma copia protegida fora da VPS. O backup inclui usuarios, sessoes, origens, eventos e checkpoints; trate-o como dado privado. Nunca versione backups.

Guarde as imagens anteriores antes de reconstruir:

```bash
docker image tag lab-nexus-sales-api:local lab-nexus-sales-api:previous
docker image tag lab-nexus-sales-web:local lab-nexus-sales-web:previous
```

Esses nomes pressupoe `APP_VERSION=local`, como no exemplo. Depois:

```bash
git status --short
git switch main
git -c credential.helper= pull --ff-only origin main
git log -1 --oneline
dc config --quiet
```

Aguarde cada etapa sem erro:

```bash
dc build api
```

```bash
dc build web
```

```bash
dc run --rm --no-deps migrate
```

```bash
dc up -d --no-build --wait api web
dc ps
curl --fail http://127.0.0.1:8089/api/ready
```

Nao use `down -v`, `docker system prune` nem remova volumes de outros projetos. Para retornar as imagens anteriores, ajuste `APP_VERSION=previous` no `.env.vps` e execute `dc up -d --no-build --wait api web`. Uma reversao de imagem nao desfaz migracoes: valide compatibilidade antes; restauracao de banco exige planejamento e backup.

## Desenvolvimento local com backend

Node 24. O `.env` das credenciais permanece separado do `.env.vps` do banco. Para desenvolvimento, crie `.env.server.local` (ignorado pelo Git) com `DATABASE_URL` de um PostgreSQL de testes e `APP_ORIGIN=http://127.0.0.1:5173`.

```powershell
npm.cmd ci --ignore-scripts
npm.cmd ci --prefix server --ignore-scripts
npm.cmd run build:server
node --env-file=.env --env-file=.env.server.local server/migrate.mjs
```

Crie a conta pelo script `server/user.mjs` com as variaveis `INITIAL_USER_*` definidas apenas no processo. Depois, em um terminal:

```powershell
node --env-file=.env --env-file=.env.server.local server/index.mjs
```

Em outro:

```powershell
$env:VITE_DATA_MODE='server'
npm.cmd run dev
```

Abra exatamente `http://127.0.0.1:5173` (a origem deve coincidir com APP_ORIGIN). Para voltar ao desktop/local, remova `VITE_DATA_MODE` do ambiente e reinicie o Vite. A suite `npm.cmd run test:server` usa PostgreSQL embarcado e respostas Hubsoft simuladas, sem ler `.env`, sem VPS e sem consultas reais.

## Validacao desta entrega

Frontend e classificador do backend compilados; 22 testes passaram, cobrindo API autenticada, PostgreSQL embarcado, importacao, deduplicacao, limites de consultas, checkpoints e respostas de rate limit. Lint sem erros, com 8 avisos preexistentes. Sintaxe YAML validada; a validacao semantica pelo Compose e o build das imagens tambem foram incluidos no workflow do GitHub. Docker nao esta instalado no computador de desenvolvimento, portanto build das imagens, redes externas, PostgreSQL real da VPS, TLS e compatibilidade dos retornos da sua Hubsoft precisam da verificacao controlada descrita acima.

## Atualizacao visual: login e abertura Brasil -> Mangaratiba

O login web segue o layout Nexus em duas colunas, com formulario responsivo e alternancia da visibilidade da senha. Depois de autenticar (ou restaurar uma sessao valida), a abertura usa uma malha SVG local do IBGE para aproximar do Brasil ate Mangaratiba. Nao consulta IBGE, tiles ou Hubsoft durante essa animacao.

O codigo maior do painel e carregado separadamente, depois da autenticacao, durante a abertura. O painel continua montado e hidratando por tras da animacao, com interacao bloqueada ate terminar. A entrada dura cerca de 4 segundos quando os dados ja estao prontos; se precisarem de mais tempo, aguarda a carga real. `Pular animacao` pula apenas a parte visual, sem liberar um painel ainda carregando. Uma base vazia e um resultado valido. Falhas oferecem nova tentativa; falha ao baixar o codigo do painel permite recarregar a pagina. `prefers-reduced-motion` desativa o zoom e elimina a espera visual.

As capturas de teste usam somente contas ficticias e uma base comercial simulada. Para verificar localmente o modo servidor, inclusive login, movimento reduzido e telas de 320/390px:

```bash
npm ci --ignore-scripts
npm run test:auth
```

No Windows os testes usam o Edge instalado; Linux/macOS usam Chromium, que pode ser instalado com `npx playwright install chromium`. Os testes iniciam seu proprio Vite em `127.0.0.1:4173` e simulam todas as rotas da API. Nao precisam de banco ou credenciais Hubsoft. Os screenshots ficam em `test-results/`, ignorado pelo Git.

Esta mudanca visual nao altera tabelas, senha minima, permissoes nem dados Hubsoft. Depois do push e merge, no terminal da VPS:

```bash
cd /home/lab/projetos/nexus-sales-intelligence
git status --short
git switch main
git pull --ff-only origin main
dc() { docker compose --env-file .env.vps -f compose.vps.yml "$@"; }
dc config --quiet
```

Com a pasta de codigo sem alteracoes pendentes, aguarde cada comando terminar sem erro:

```bash
dc build web
```

```bash
dc up -d --no-deps --no-build --wait web
```

```bash
dc ps
curl --fail http://127.0.0.1:8089/healthz
curl --fail http://127.0.0.1:8089/api/ready
```

Use `APP_VERSION` que ja esta em uso no ambiente. Nao precisa executar migracoes, recriar usuarios ou reconstruir a API para esta atualizacao. Acesse a URL HTTPS e saia da sessao para visualizar o formulario novo. Uma janela InPrivate tambem permite verificar sem encerrar a sessao da janela atual.


## Cadastro de usuários pelo painel

No modo servidor, a aba **Usuários**, abaixo de **Equipe comercial**, lista os acessos existentes e permite criar uma conta com nome, e-mail e senha inicial de 12 a 256 caracteres. A pessoa pode entrar imediatamente com os dados cadastrados; não há envio de convite por e-mail. Todas as contas autenticadas podem criar usuários, seguindo o modelo atual de permissões iguais. Senhas são armazenadas com scrypt e nunca retornam na listagem. O script `server/user.mjs` continua disponível para criar a primeira conta.

Esta atualização exige reconstruir **API e web**. As instruções anteriores de reconstruir somente web se aplicam à entrega visual anterior. Não há nova migração nem necessidade de recriar contas existentes. Depois do merge, na VPS, com `git status --short` sem alterações pendentes:

```bash
cd /home/lab/projetos/nexus-sales-intelligence
git switch main
git pull --ff-only origin main
dc() { docker compose --env-file .env.vps -f compose.vps.yml "$@"; }
dc config --quiet
dc build api
dc build web
dc up -d --no-build --wait api web
dc ps
curl --fail http://127.0.0.1:8089/api/ready
```

Execute um comando por vez e aguarde concluir sem erro. Mantenha o `APP_VERSION` já usado na VPS. Após atualizar o navegador, entre em **Usuários → Novo usuário**. Os testes de cadastro usam PostgreSQL embarcado e API simulada no navegador, sem acessar Hubsoft ou a VPS.
