# Carga e atualizacao automatica do Sales

Implementada por solicitacao de 10/11/2026. Servico separado na VPS, sem depender do navegador ou do computador local. Nao precisa enviar quatro planilhas por lote: a coleta usa a API e registra validacao tecnica `api_snapshot`. Isso nao equivale a uma reconciliacao independente com um relatorio Hubsoft; o resultado registra `externalReportReconciled=false` e `approved=false` no job, sem inventar revisor ou hash de planilha. Os pilotos ja aprovados e suas evidencias permanecem intactos.

## Comportamento

- Corte inicial **01/01/2025**, incluindo 2025 e os anos seguintes ate ontem. Outubro/2026 aprovado continua como pre-requisito de calibracao. A configuracao em `deploy/automatic-sync.example.json` seleciona esse corte e o ultimo mes fechado como fim dinamico da carga historica. Nao coleta janelas anteriores ao corte nem dias futuros/em andamento.
- Na ativacao apos as 02h (America/Sao_Paulo), primeiro atualiza os ultimos 30 dias completos, ate ontem; depois preenche janeiro/fevereiro de 2025, marco/abril de 2025 e assim por diante, inclusive atraves da virada de ano, ate o ultimo mes fechado. Meses inteiros ja publicados/aprovados sao preservados e pulados na carga historica. Outubro/2026 ja aprovado nao e recarregado como novo lote. Janela diaria parcial nao faz um mes historico ser considerado completo.
- Publica um mes por transacao, espera cinco minutos antes do seguinte e limita cada job a dois meses. O servico cria e acompanha o proximo lote sozinho. A revisao diaria volta a ter prioridade depois que o lote ativo termina.
- Todos os dias a partir das 02h, revisa os ultimos 30 dias completos. Se o servico estiver parado, a proxima partida faz a revisao vencida. Se os 30 dias tocarem tres meses, divide em jobs de ate dois meses e persiste o cursor restante. A fonte de alteracoes captura atendimentos ja publicados desde 2025, abertos antes da janela; nao expoe mes antigo parcialmente so porque recebeu uma alteracao. Ate 50 pendencias antigas, ordenadas pela ultima observacao, tambem sao verificadas por mes de coleta; a fila gira entre ciclos. Nao reconsulta todos os anos diariamente.
- Atendimento por cadastro, alteracoes por ultima alteracao e OS pela conclusao executada, com pagina explicita de 50 e um dia por chamada. O endpoint proprio de OS continua presente, incluindo OS cujo atendimento foi aberto em outro mes.
- Complemento exato por protocolo em cache proprio de cada job, validando identidade, cliente e dia. Cada ciclo tem cache novo para refletir alteracoes. Instalacoes recuperam pais ausentes exclusivamente pelo ID/protocolo presente na OS; contexto ainda nao carregado fica restrito aos vinculos ate a carga primaria do seu mes. Duas instalacoes com o mesmo pai preservam os dois vinculos. Se o detalhe exato revelar abertura anterior a 01/01/2025, o atendimento nao e persistido; a OS do periodo e preservada com `context_status=before_scope` e nao gera venda sem o atendimento exigido pela regra. A auditoria registra essa quantidade. Ausencia do protocolo ou identidade divergente pausa, sem busca aproximada.
- Upsert canonico, deduplicacao entre OS diretas/embutidas, preservacao de checklists e rascunhos na origem e mesmas regras comerciais. Nenhuma regra de renovacao, cancelamento, vendedor ou plano foi alterada nesta entrega.
- Uma chamada por vez, 1 req/s, gate e token compartilhados com o Sales. O limite de 5000 inclui OAuth, paginas, complementos, contextos e retomadas do lote inteiro. Em 429, respeita cooldown e registra politica. Demais consumidores Hubsoft no mesmo IP continuam exigindo coordenacao externa.
- Paginas e caches sobrevivem a reinicios. Um controlador persistido e um lock impedem agendar lotes duplicados. Nenhuma ausencia na resposta e interpretada como autorizacao de apagar registros. Antes de substituir dados publicados da janela, verifica se suas identidades continuam presentes. Qualidade insuficiente, paginacao inconsistente, exclusao upstream, divergencia de identidade ou fim de orcamento pausam com codigo de erro; nao geram tentativas infinitas nem aumentam limites sozinhos.
- Falha de publicacao faz rollback dos upserts e dos indicadores; o painel conserva a ultima versao publicada. Meses anteriores publicados permanecem disponiveis. Alteracoes legitimas de registros antigos podem corrigir indicadores antigos.
- Preserva o limite global de 50 mil registros da base. Mantem snapshots para auditoria; nao executa limpeza automatica de jobs, volumes ou relatorios.

## Deploy na VPS

Depois do push, checks verdes e merge, executar no **Bash da VPS**, dentro do repositorio do Sales:

```bash
cd /home/lab/projetos/nexus-sales-intelligence
git status -sb
git switch main
git pull --ff-only origin main
git log -3 --oneline
dc() { docker compose --env-file .env.vps -f compose.vps.yml "$@"; }
SALES_VERSION="$(git rev-parse --short HEAD)"
sed -i "s/^APP_VERSION=.*/APP_VERSION=${SALES_VERSION}/" .env.vps
dc config --quiet
dc build api
```

Continuar apenas se cada etapa terminar com sucesso. Esta entrega requer **nova migracao**; nao alterar migracoes antigas nem apagar dados. Se o servico automatic ja existir, para-lo antes de migrar/atualizar sua imagem.

```bash
dc run --rm --no-deps migrate
dc up -d --no-deps --no-build --force-recreate --wait api
dc ps
curl --fail http://127.0.0.1:8089/api/ready
```

Nao precisa reconstruir o web nesta entrega. A imagem API tambem contem os coletores.

## Configuracao unica e ativacao

Conferir o UUID de outubro em `deploy/automatic-sync.example.json`. Esse e o job ja aprovado da operacao atual. `plan` nao acessa DB/Hubsoft; `configure` grava a configuracao desativada no DB, sem chamadas remotas. O helper envia o arquivo pelo stdin para evitar problemas de UID/SELinux de arquivos privados.

```bash
auto_file() {
  dc run --rm --no-deps -T --interactive --entrypoint sh history -c '
    set -eu
    automatic_input=$(mktemp /tmp/automatic-input.XXXXXX)
    cat > "$automatic_input"
    exec node server/jobs/automatic-sync.mjs "$1" "$automatic_input"
  ' auto-file "$1" < deploy/automatic-sync.example.json
}
auto_file plan
auto_file configure
```

Nao repetir `configure` quando ja configurado; o comando protege a fila existente. Para parar/retomar, usar os comandos abaixo.

Editar `.env.vps` na VPS com `nano .env.vps` e adicionar/ajustar estas chaves, sem mexer nas credenciais existentes:

```dotenv
HUBSOFT_AUTOMATIC_ENABLED=true
HUBSOFT_HISTORY_IP_COORDINATED=true
HUBSOFT_REQUESTS_PER_SECOND=1
```

Ativacao operacional, apos a configuracao e a API saudavel:

```bash
auto() { dc run --rm --no-deps --entrypoint node history server/jobs/automatic-sync.mjs "$@"; }
auto enable
dc --profile automation up -d --no-deps --no-build automatic
auto status
dc logs --tail=30 automatic
```

O perfil e opt-in: `dc up api web` sozinho nunca inicia esse servico. Depois de ativado, `restart: unless-stopped` retoma apos reinicio da VPS, usando os checkpoints do PostgreSQL. So deve haver um servico automatic; nao iniciar `history run` ou outros coletores historicos para esses mesmos meses ao mesmo tempo.

## Acompanhar ou pausar

```bash
auto status
dc logs --tail=50 automatic
auto pause
```

`pause` impede novas etapas; uma chamada ja iniciada pode terminar e salvar seu checkpoint. Para interromper o processo de imediato de forma controlada, `dc stop automatic` recebe SIGTERM e encerra apos a etapa atual. Nenhum comando apaga os dados.

Depois de corrigir a causa de uma pausa por erro:

```bash
auto resume
dc --profile automation up -d --no-deps --no-build automatic
```

O orcamento ja consumido continua consumido ao retomar. Nao usar `resume` em loop para contornar falhas ou teto. `error_code` mostra a pendencia, `job.current_month` o mes atual, `month_totals` o staging, `calls` consumo/latencia/429, `history_months.reconciliation` a auditoria tecnica da publicacao. `awaiting_validation` e uma etapa interna curta antes da validacao tecnica automatica; erros nessa etapa preservam o painel e interrompem a fila.

Na virada do ano, mantem o corte inicial de 01/01/2025 e continua ate ontem. Os novos meses fechados entram na fila automaticamente; nao precisa trocar o ano em codigo nem carregar novamente todos os anos anteriores.

Uma exportacao pontual de relatorio continua util para investigar divergencias comerciais. Ela nao e mais requisito operacional de cada mes da automacao.
