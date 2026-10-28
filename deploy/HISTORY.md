# Carga histórica Hubsoft de 2026

Implementação preparada para testes locais. **Piloto escolhido: 15/10/2026. Não iniciar a carga real sem os relatórios, o corte do acompanhamento e a coordenação dos consumidores do IP.** Não depende de autorização adicional de administrador Hubsoft; depende das permissões técnicas das credenciais existentes.

## Antes de publicar

- Migrações aditivas: `002_history.sql` e `003_attendance_followups.sql` (a segunda é nova nesta atualização). Aplicar antes de recriar a API.
- API e worker compartilham `hubsoft_gate`, locks PostgreSQL, cooldown e cache de token cifrado. A criptografia deriva do segredo OAuth que já fica no backend; não exibir o banco ou logs desse cache. Rotacionar o segredo invalida o cache e exige renovação.
- `HUBSOFT_REQUESTS_PER_SECOND=1` por padrão; somente `1` ou `2` aceitos. Sem burst. A política OAuth recebe intervalo mínimo adicional de 2,1 segundos.
- Mapear os **outros programas** que acessam Hubsoft pelo IP. O gate coordena os processos do Sales; não pode controlar programas externos que não aderirem. Confirmar coordenação ou reservar janela exclusiva antes de habilitar `HUBSOFT_HISTORY_IP_COORDINATED=true`.
- `HUBSOFT_HISTORY_ENABLED=false` por padrão. O worker não inicia em `docker compose up` normal. Não alterar o `.env` preenchido nem versionar credenciais.

## Planejamento sem API ou banco

O arquivo `deploy/history-manifest.example.json` é um modelo **inválido de propósito**, até substituir os campos. `maxCalls=500` é apenas orçamento ilustrativo para o primeiro dia; ajustar após revisão do volume. O script contabiliza todas as chamadas externas do job, inclusive OAuth, erros e complementos. Ao esgotar, pausa sem consultar novamente.

```bash
node server/jobs/import-year.mjs plan caminho/manifesto.json
```

Esse comando somente valida e mostra o plano. Não lê `.env`, não conecta ao PostgreSQL e não chama a Hubsoft. `help` também é local.

O piloto A usa `phase=day`, `peakDay=2026-10-15` e produção desse dia exato; não de outubro inteiro. O corte precisa ser anterior ao dia atual em São Paulo. Relatórios de Atendimentos e Ordens de Serviço devem ter o mesmo intervalo, campo de data e universo da extração. Cada referência informa SHA-256 do arquivo exportado, instante de exportação e filtros.

Por segurança, esta primeira implementação aceita relatórios sem filtros adicionais (`otherFilters=none`), com `dateField` explícito. Se os relatórios tiverem status, tipos, setores ou outros recortes, **não declarar que estão sem filtros**: mapear esses filtros antes de iniciar. Isso depende dos relatórios reais, ainda não fornecidos. O filtro legado `destino=cliente_servico` da rota de OS também precisa ser confirmado contra o universo dos relatórios.

## Operação na VPS após o piloto estar autorizado

Definir o `dc` do **Sales**, com `compose.vps.yml` apenas. Não usar o compose do Tasks. Os exemplos abaixo são de operação futura; não estão executados automaticamente no deploy.

```bash
dc run --rm --no-deps history plan /arquivo/manifesto.json
dc run --rm --no-deps history create /arquivo/manifesto.json
dc run --rm --no-deps history status UUID
dc run --rm --no-deps history start UUID
dc run --rm --no-deps history run UUID
dc run --rm --no-deps history pause UUID
dc run --rm --no-deps history cancel UUID
```

O serviço `history` recebe o comando como argumentos do script; arquivos locais precisam de um bind mount somente leitura, por exemplo `-v /caminho/restrito:/arquivo:ro`, antes de `history`. O diretório real e o manifesto serão definidos com o operador; não embutir arquivos de clientes na imagem.

Para iniciar e publicar, ambas as flags `HUBSOFT_HISTORY_ENABLED` e `HUBSOFT_HISTORY_IP_COORDINATED` precisam ser `true` na configuração do serviço. `create` grava somente o plano; `start` permite trabalho; `run` faz etapas até pausar ou pedir validação. A carga continua sem navegador aberto. `pause` e `cancel` impedem novas etapas e preservam a página recebida. Sinais SIGTERM/SIGINT terminam no checkpoint, sem zerar a base.

`status` mostra estado, retomada, registros únicos, páginas processadas, chamadas, OAuth, 429, latência média, p95 e máxima. Os horários e as métricas brutas ficam no banco para o relatório; não se imprimem tokens, URLs completas com parâmetros ou payloads. Para confronto restrito de IDs:

```bash
dc run --rm --no-deps -v /diretorio/restrito:/saida history export-ids UUID /saida/ids.json
```

## Validação e publicação

### Produção e acompanhamento são populações diferentes

Para o piloto escolhido, usar `peakDay=2026-10-15`, `cutoff=2026-10-15`, `osDateField=data_termino_executado` e informar `followupCutoff` separadamente. O corte do acompanhamento precisa ser um dia completo, anterior ao dia atual em São Paulo e não anterior ao período de abertura. Em 28/10, por exemplo, **27/10/2026 pode ser proposto como corte**, sujeito à conferência dos relatórios; isso não habilita a carga.

| População | Seleção e uso |
| --- | --- |
| Atendimentos do piloto | Cadastro em 15/10, sem criar uma hora para um campo que contém somente data. |
| Produção de OS | Conclusão em 15/10, inclusive OS de atendimento anterior ou sem atendimento. |
| Acompanhamento dos atendimentos | OS ligadas por `id_atendimento` aos atendimentos abertos em 15/10. Pode incluir conclusão posterior, pendência, cancelamento e programação em outro mês. |

Exemplo: atendimento em 15/10 e OS concluída em 20/10 entram no acompanhamento do dia 15 e na produção do dia 20, cada qual em sua análise. A execução do piloto **não conta essa OS na produção do dia 15** e não precisa consultar todos os dias entre 16 e 27. O endpoint por cliente retorna os vínculos atuais do atendimento selecionado por cadastro. Atendimentos sem OS também ficam registrados; o acompanhamento é uma relação de um atendimento para várias OS.

Com `followupCutoff`, a consulta por cliente distinto e dia acontece mesmo quando o nome de abertura já veio preenchido: precisamos dos vínculos completos. Cada atendimento é encontrado pelo seu ID, nunca apenas pelo nome do cliente. A consulta histórica de produção por conclusão usa apenas um fluxo de OS, evitando repetir o mesmo endpoint/filtro. O endpoint direto de OS continua obrigatório para cobrir OS sem atendimento.

Os vínculos ficam em `history_followup_attendances` e `history_followup_orders`. Após validação, são publicados em `attendance_followup_snapshots` e `attendance_order_followups`, separados de `source_records` e dos indicadores de produção. Não há uma aba nova de acompanhamento nesta entrega. Há consulta autenticada de leitura em `GET /api/hubsoft/history/UUID/followup`, somente com meses publicados, e exportação operacional do staging para revisar antes da aprovação:

```bash
dc run --rm --no-deps -v /diretorio/restrito:/saida history export-followup UUID /saida/acompanhamento.json
```

Esse arquivo contém IDs dos vínculos, datas e estados, sem nome, CPF, telefone ou descrição do cliente. É uma análise de acompanhamento, **não deve ser somada ao total de produção**. `export-ids` continua contendo somente a população de produção para o confronto com os dois relatórios originais.

O relatório separa conclusões até o corte (`concluded_by_cutoff`), conclusões posteriores conhecidas (`concluded_after_cutoff`), pendências observadas (`pending_observed`), cancelamentos observados (`cancelled_observed`), status desconhecido e finalização sem data. OS cujo cadastro é posterior ao corte não entra nessa amostra. Se não há data de cadastro nem conclusão até o corte, `existenceAtCutoff=unknown`: não se afirma que a OS já existia naquele momento. Conclusão anterior à abertura também é sinalizada separadamente para revisão.

**O corte de eventos não reconstrói o histórico de status da Hubsoft.** `observedAt` informa quando a resposta foi capturada; pendência e cancelamento são estados vistos nessa captura, não prova do estado em 27/10. Sem data/eventos de cancelamento, não se inventa quando ele ocorreu. Um novo acompanhamento exige um novo job, corte e referências atualizados; o cache de um job já capturado não é tratado como atualização diária. A sincronização recorrente continua sendo etapa posterior.

OS concluída sem programação pode entrar na produção se tiver os demais campos e a conclusão válidos. OS pendente ou cancelada não precisa receber programação/conclusão fictícias para preservar o vínculo. Datas ISO com offset são convertidas para São Paulo antes de selecionar o dia. Uma OS às 01:30 UTC de 16/10 pertence a 15/10 às 22:30 em São Paulo. Um timestamp de OS com somente data é rejeitado.

A carga nova grava `data_referencia_bi=data_termino_executado` nas OS de produção. O classificador usa a conclusão para esses registros, inclusive reativações. Planilhas e registros legados sem essa marca preservam a regra anterior. Vínculos nativos têm preferência sobre heurísticas por texto/cliente; OS com ID nativo sem atendimento não é atribuída automaticamente a outro atendimento do mesmo cliente.

### Conferência adicional dos vínculos

Além dos relatórios de produção, informar `reports.followup` (ou `monthReports[MES].followup`) com SHA-256 da conferência independente dos vínculos, instante de exportação e filtros `dateField=data_cadastro`, `relationship=id_atendimento`, `followupCutoff` igual ao manifesto e `otherFilters=none`. Conferir as OS dos atendimentos selecionados, não somente as OS concluídas em 15/10. Isso pode exigir conferir os vínculos nas consultas/relatórios Hubsoft, pois um relatório diário de conclusões sozinho não comprova o acompanhamento.

Na evidência de aprovação, adicionar `followup={"reportSha256":"HASH_DA_CONFERENCIA","ids":["IDS_DAS_OS_VINCULADAS"]}`. Os IDs são `id_ordem_servico`, não números exibidos da OS. Atendimentos sem OS são conferidos pela cobertura exata dos IDs de atendimentos. Para continuidade automática da fase C, fornecer também `monthReports[MES].followup.ids`. Divergência em qualquer população reverte toda a publicação, inclusive produção, na mesma transação.

O worker verifica quantidade declarada de OS contra a lista recebida quando a quantidade é fornecida. Lista ausente sem quantidade zero explícita, lista incompleta, ID duplicado ou pai divergente pausam a carga e preservam o checkpoint. As três conferências são independentes; os totais anteriores de outubro (1.267 atendimentos e 566 OS) precisam ser reconfirmados com **cadastro de atendimento e conclusão de OS**, antes de serem usados como referência. Não forçar esses números se o relatório anterior usava outro campo de data.

Os dados são gravados em `history_pages`, `history_clients` e `history_records`, separados dos indicadores publicados. Cada página é capturada uma vez e os complementos ficam persistidos. O nome de abertura e os vínculos de OS são procurados por cliente distinto e dia de abertura; diferentes atendimentos do mesmo cliente mantêm nomes distintos. A rota de cliente cheia (50 itens) pausa com `HUBSOFT_CLIENTE_PAGINACAO_NAO_CONFIRMADA`, pois não há contrato validado para navegar além do limite. Não existe fallback por protocolo na carga histórica.

IDs de origem são obrigatórios. Atendimentos de precisão diária não recebem uma hora inventada. OS exige hora nos campos de data preenchidos. O campo de data de negócio define o mês, e um registro fora de 2026/corte não entra no mês. OS embutida e direta são deduplicadas pelo ID; a versão direta tem preferência sobre uma embutida. Divergências sem versão verificável precisam ser revistas no piloto. A chave `hubsoft:ID` em `source_records`, junto de `kind`, preserva o ID canônico; o protocolo/número fica no payload. Registros legados sem IDs continuam legíveis e são relacionados pelo número de negócio quando ele for unívoco. Se a associação for ambígua, o processo para. Reimportações de planilha usam essa associação para evitar duplicar o registro canônico.

Ao terminar o mês, o estado passa a `awaiting_validation`. Fornecer uma evidência JSON com `month`, `reviewer`, `confirmFilters=true` e, para `attendance` e `serviceOrders`, `reportSha256` e a lista `ids` do respectivo relatório. Exemplo de estrutura, com valores fictícios:

```json
{"month":"2026-10","reviewer":"Operador","confirmFilters":true,
 "attendance":{"reportSha256":"HASH_DO_RELATORIO","ids":["101"]},
 "serviceOrders":{"reportSha256":"HASH_DO_RELATORIO","ids":["201","202"]}}
```

```bash
dc run --rm --no-deps -v /caminho/restrito:/arquivo:ro history approve UUID /arquivo/evidencia.json
```

Se os conjuntos de IDs divergirem, não há publicação. Se coincidirem, gravação dos registros e reconstrução dos indicadores ocorrem na mesma transação. A publicação não apaga os outros meses. O limite de 50 mil registros permanece. Antes de qualquer publicação, manter backup do schema do Sales e ensaio de restauração isolada; não restaurar o banco `lab` inteiro.

O piloto B (`phase=october`) exige `approvedDayJob`, com o piloto A concluído e aprovado, e outubro fechado. Até 31/10, o comando recusa chamá-lo de mês integral. Se forem parciais, os totais 1.267/566 precisam ser comparados no corte correspondente, sem apresentá-los como fechamento. O piloto mensal usa os relatórios efetivamente exportados, não números forçados.

A fase C (`phase=history`) exige `approvedOctoberJob` concluído/aprovado, corte pelo menos 31/10 e `monthReports` com referências de janeiro a setembro. Após cada aprovação, há espera persistida de cinco minutos; janeiro respeita também o próximo horário do piloto de outubro. Por padrão, cada mês pede evidência. Para continuar automaticamente, o manifesto pode usar `autoPublish=true`, `reviewer` e as listas `ids` já conferidas em cada `monthReports[MES][ENTIDADE]`; a igualdade dos conjuntos continua obrigatória. Divergência pausa a publicação.

Janela noturna opcional: `window={"start":"22:00","end":"06:00"}`. O exemplo não é um agendamento ativado; a janela usa America/Sao_Paulo e pausa fora dela. Ao reiniciar, o horário salvo e o cooldown continuam valendo.

## Pendências de validação real

Confirmar relatórios/filtros/corte do dia 15, paginação por cliente, OS sem programação, nomes retornados e capacidade de memória da consolidação. Se a carga receber uma exclusão dentro do mês alvo, pausa com `EXCLUSAO_EXIGE_RECONCILIACAO`: não ignora a divergência nem apaga registros anteriores automaticamente. Esse caso requer regra validada com o relatório antes de liberar a carga maior. O worker tem limite próprio de memória/CPU; esse isolamento não substitui monitorar host e PostgreSQL compartilhado. Não foi implementada uma coleta automática de métricas do host remoto: o piloto precisa de monitoramento operacional. Métricas acumuladas e staging devem ter retenção definida antes de cargas recorrentes. A sincronização diária automática é etapa posterior; não foi agendada.
