# Carga histórica Hubsoft de 2026

Implementação preparada para testes locais. **Piloto escolhido: 01/10/2026, após análise dos relatórios exportados em 29/10. Veja [a análise e as pendências do piloto](PILOT_OCTOBER_2026.md). Não iniciar a carga real sem os relatórios, o corte do acompanhamento e a coordenação dos consumidores do IP.** Não depende de autorização adicional de administrador Hubsoft; depende das permissões técnicas das credenciais existentes.

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

O piloto A usa `phase=day`, `peakDay=2026-10-01` e produção desse dia exato; não de outubro inteiro. O corte precisa ser anterior ao dia atual em São Paulo. Relatórios de Atendimentos e Ordens de Serviço devem ter o mesmo intervalo, campo de data e universo da extração. Cada referência informa SHA-256 do arquivo exportado, instante de exportação e filtros.

Por segurança, esta primeira implementação aceita relatórios sem filtros adicionais (`otherFilters=none`), com `dateField` explícito. Se os relatórios tiverem status, tipos, setores ou outros recortes, **não declarar que estão sem filtros**: mapear esses filtros antes de iniciar. O usuário confirmou em 29/10 que ambas as exportações usaram somente Data de Cadastro entre 01/10 e 31/10. O print de Atendimentos confirma Tipo de Endereço = Instalação, sem seleção em Tipo de Atendimento. Os 16 números de OS concluídas em 01/10 encontrados no arquivo por cadastro são uma referência parcial, que não comprova a presença de OS cadastradas antes de outubro. O filtro legado `destino=cliente_servico` da rota de OS também precisa ser confirmado contra o universo dos relatórios.

## Conferência automática por protocolo e número de OS

Os relatórios originais podem usar `keyField=protocolo` para atendimento e `keyField=numero_ordem_servico` para OS, com `keys` contendo os identificadores como strings. O armazenamento continua usando IDs nativos. A conferência gera `mapping=[{key,id}]`, compara conjuntos exatos e informa `missing`, `extra` e `ambiguous`. Nunca deduz um ID pelo número, nome ou cliente. Mais de um ID para um número bloqueia a aprovação. As listas fixadas nas referências não podem ser substituídas silenciosamente por listas diferentes na evidência de aprovação.

Para referências antigas sem `keyField`, a lista `ids` continua funcionando. Nos novos relatórios, `fileSha256` identifica o XLSX original e `keys` é a seleção local de linhas na data de negócio. `filters.dateField` descreve essa seleção, enquanto `exportFilters.dateField` registra o campo usado na exportação original. Essa separação evita declarar falsamente que uma exportação por cadastro comprova o universo de conclusões.

O script local `scripts/prepare-hubsoft-reports.py` lê XLSX ou um ZIP contendo um XLSX. Requer Python com `openpyxl`, não chama a API nem abre `.env`. Remove somente o rodapé final reconhecido, rejeita chaves duplicadas e números sem precisão, grava hashes dos arquivos originais e exporta somente referências/identificadores, sem nomes, CPF, telefone ou descrições. Não modifica as planilhas. Exemplo de preparação local:

```bash
python scripts/prepare-hubsoft-reports.py --attendance atendimentos.zip --orders os.zip --day 2026-10-01 --snapshot-date 2026-10-29 --followup-cutoff 2026-10-28 --os-export-date-field data_cadastro --output tmp/piloto-2026-10-01
```

São gerados `manifest.json`, `references.json` e `evidence-draft.json`, em diretório privado e não versionado. A evidência nasce com `reviewer=null` e `confirmFilters=false`, portanto não é uma aprovação. O preparador não sobrescreve arquivos já existentes. Os arquivos reais fornecidos produziram 107 protocolos e 16 números de OS para a referência do dia 1.

O piloto diário permite `reports.followup.pending=true` para coletar e inspecionar os vínculos antes de ter a referência completa. Isso **não** libera publicação ou continuidade automática. Uma referência pendente nunca é aceita para aprovação. A exportação de OS por cadastro gera `ESCOPO_RELATORIO_NAO_COMPARAVEL`, mesmo quando todos os 16 números conferem: podem existir OS de setembro concluídas no dia 1. Obter uma referência por conclusão para resolver essa diferença de universo. Manter a regra de conclusão da carga.

A conferência abaixo lê apenas o PostgreSQL, não faz requisições Hubsoft e não publica dados:

```bash
dc run --rm --no-deps history reconcile UUID
dc run --rm --no-deps -v /diretorio/restrito:/saida history reconcile UUID /saida/conferencia.json
```

`publishable=true` exige coleta terminada e todas as referências completas e iguais ao staging. O arquivo de conferência é um diagnóstico, não uma fonte independente: não copiar os IDs encontrados nele e tratá-los como comprovação do relatório. Divergências devem ser investigadas contra a exportação original.

Quando houver referências corrigidas, anexar um objeto JSON com `attendance`, `serviceOrders` e `followup` ao mesmo job, sem recoletar páginas já salvas:

```bash
dc run --rm --no-deps -v /diretorio/restrito:/entrada:ro history attach-reports UUID /entrada/references.json
```

Somente jobs planejados, pausados ou aguardando validação aceitam essa operação, protegida pelo lock da carga. Ela altera somente referências, nunca período, limite, campo de data ou dados coletados. Referências novas precisam conter hashes e listas obtidos das fontes corretas. A lista da evidência de aprovação usa `keys` quando `keyField` é um número de negócio; a conversão para IDs ocorre automaticamente na validação. A aprovação continua explícita e transacional. Para esta atualização, reconstruir API; não há nova migração além da `003` já aplicada. As flags reais de carga permanecem sob controle do operador e não são habilitadas no deploy.

## Exceção autorizada para o piloto de 01/10

Autorizada pelo usuário em 29/10/2026 após os diagnósticos reais: a consulta por cliente e dia retornou uma lista vazia, inclusive com `tipo_data=data_cadastro` explícito. A busca exata por protocolo retornou um atendimento com ID, protocolo, código de cliente e dia iguais aos da listagem, além do nome de abertura e da lista de OS. A causa interna dessa diferença na Hubsoft não foi determinada. O teste com horários explícitos foi recusado e não foi incorporado ao importador.

O padrão permanece consulta por cliente. A exceção é somente para a fase `day`, dia `2026-10-01`, por ativação explícita do job pausado. Não é uma tentativa automática depois de uma busca vazia e não se aplica a outubro completo ou janeiro-setembro. O usuário autorizou substituir a estratégia nesse piloto: pelos relatórios, cerca de 107 consultas de detalhe em vez de 93 por cliente, sem tentar novamente cada cliente antes de cada protocolo.

Após publicar esta atualização da API, com as mesmas flags temporárias e ritmo de 1 req/s usados na função `pilot`, executar:

```bash
pilot enable-pilot-protocol 8a55cdb3-eead-4288-b74b-aab99ad24b71
```

Esse comando **não faz HTTP, não inicia o job e não publica registros**. Registra `enrichmentStrategy=protocol` e uma permissão em `protocolException`, vinculada ao ID do próprio job e à data de abertura. Aceita somente o piloto diário de 01/10 pausado pelo erro de atendimento não resolvido. Preserva o estado pausado, limite, contagem acumulada de chamadas, horário de retomada, páginas e dados já salvos. O teto não pode ultrapassar 500 e o worker rejeita ritmo diferente de 1 req/s nessa estratégia.

Conferir na saída `state=paused` e `enrichment_strategy=protocol`. Depois, a retomada do **mesmo job** continua com:

```bash
pilot start 8a55cdb3-eead-4288-b74b-aab99ad24b71
pilot run 8a55cdb3-eead-4288-b74b-aab99ad24b71
```

Não recriar o job nem apagar sua página pendente. A consulta exata usa `busca=protocolo`, `limit=1` e `apenas_pendente=nao`, sem um filtro de datas que possa excluir o próprio registro. Não varre o histórico: identifica um único atendimento e valida sua data contra o dia da listagem antes de aceitar o retorno. Zero, múltiplos resultados, protocolo, ID, cliente ou dia divergentes interrompem a etapa. Não utiliza o responsável como substituto do usuário de abertura.

O detalhe é minimizado por `projectHistoryRecord` e salvo em `application_settings`, em chaves `hubsoft_history_protocol:JOB:ID_ATENDIMENTO`, com instante de observação por atendimento. CPF, telefone e campos arbitrários não entram nesse cache. A consulta já resolvida não é repetida ao reprocessar a página ou encontrar o mesmo atendimento em outro fluxo. O cache por cliente, inclusive sua resposta vazia, permanece intacto. A retenção desse cache acompanha a política futura de retenção dos jobs, sem limpeza automática nesta entrega.

As chamadas de diagnóstico já feitas continuam no orçamento original, assim como OAuth, erros e consultas de OS. As regras de publicação são preservadas: referência de OS exportada por cadastro não comprova o universo por conclusão, e os vínculos ainda precisam de conferência independente. A autorização desta exceção não é uma aprovação dos indicadores. Não há migração nova nem necessidade de alterar `.env.vps`; reconstruir somente a API e ativar a exceção no job após o deploy.

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

Para o piloto escolhido, usar `peakDay=2026-10-01`, `cutoff=2026-10-01`, `osDateField=data_termino_executado` e informar `followupCutoff` separadamente. O corte do acompanhamento precisa ser um dia completo, anterior ao dia atual em São Paulo e não anterior ao período de abertura. A referência de acompanhamento passa a **28/10/2026**, último dia completo anterior à exportação de 29/10, sujeita à conferência dos vínculos; isso não habilita a carga.

| População | Seleção e uso |
| --- | --- |
| Atendimentos do piloto | Cadastro em 01/10, sem criar uma hora para um campo que contém somente data. |
| Produção de OS | Conclusão em 01/10, inclusive OS de atendimento anterior ou sem atendimento. |
| Acompanhamento dos atendimentos | OS ligadas por `id_atendimento` aos atendimentos abertos em 01/10. Pode incluir conclusão posterior, pendência, cancelamento e programação em outro mês. |

Exemplo ilustrativo: atendimento em 01/10 e OS concluída em 20/10 entram no acompanhamento do dia 1 e na produção do dia 20, cada qual em sua análise. A execução do piloto **não conta essa OS na produção do dia 1** e não precisa consultar todos os dias entre 2 e 28. O endpoint por cliente retorna os vínculos atuais do atendimento selecionado por cadastro. Atendimentos sem OS também ficam registrados; o acompanhamento é uma relação de um atendimento para várias OS.

Com `followupCutoff`, a consulta por cliente distinto e dia acontece mesmo quando o nome de abertura já veio preenchido: precisamos dos vínculos completos. Cada atendimento é encontrado pelo seu ID, nunca apenas pelo nome do cliente. A consulta histórica de produção por conclusão usa apenas um fluxo de OS, evitando repetir o mesmo endpoint/filtro. O endpoint direto de OS continua obrigatório para cobrir OS sem atendimento.

Os vínculos ficam em `history_followup_attendances` e `history_followup_orders`. Após validação, são publicados em `attendance_followup_snapshots` e `attendance_order_followups`, separados de `source_records` e dos indicadores de produção. Não há uma aba nova de acompanhamento nesta entrega. Há consulta autenticada de leitura em `GET /api/hubsoft/history/UUID/followup`, somente com meses publicados, e exportação operacional do staging para revisar antes da aprovação:

```bash
dc run --rm --no-deps -v /diretorio/restrito:/saida history export-followup UUID /saida/acompanhamento.json
```

Esse arquivo contém IDs dos vínculos, datas e estados, sem nome, CPF, telefone ou descrição do cliente. É uma análise de acompanhamento, **não deve ser somada ao total de produção**. `export-ids` continua contendo somente a população de produção para o confronto com os dois relatórios originais.

O relatório separa conclusões até o corte (`concluded_by_cutoff`), conclusões posteriores conhecidas (`concluded_after_cutoff`), pendências observadas (`pending_observed`), cancelamentos observados (`cancelled_observed`), status desconhecido e finalização sem data. OS cujo cadastro é posterior ao corte não entra nessa amostra. Se não há data de cadastro nem conclusão até o corte, `existenceAtCutoff=unknown`: não se afirma que a OS já existia naquele momento. Conclusão anterior à abertura também é sinalizada separadamente para revisão.

**O corte de eventos não reconstrói o histórico de status da Hubsoft.** `observedAt` informa quando a resposta foi capturada; pendência e cancelamento são estados vistos nessa captura, não prova do estado em 28/10. Sem data/eventos de cancelamento, não se inventa quando ele ocorreu. Um novo acompanhamento exige um novo job, corte e referências atualizados; o cache de um job já capturado não é tratado como atualização diária. A sincronização recorrente continua sendo etapa posterior.

OS concluída sem programação pode entrar na produção se tiver os demais campos e a conclusão válidos. OS pendente ou cancelada não precisa receber programação/conclusão fictícias para preservar o vínculo. Datas ISO com offset são convertidas para São Paulo antes de selecionar o dia. Uma OS às 01:30 UTC de 16/10 pertence a 15/10 às 22:30 em São Paulo. Um timestamp de OS com somente data é rejeitado.

A carga nova grava `data_referencia_bi=data_termino_executado` nas OS de produção. O classificador usa a conclusão para esses registros, inclusive reativações. Planilhas e registros legados sem essa marca preservam a regra anterior. Vínculos nativos têm preferência sobre heurísticas por texto/cliente; OS com ID nativo sem atendimento não é atribuída automaticamente a outro atendimento do mesmo cliente.

### Conferência adicional dos vínculos

Além dos relatórios de produção, informar `reports.followup` (ou `monthReports[MES].followup`) com SHA-256 da conferência independente dos vínculos, instante de exportação e filtros `dateField=data_cadastro`, `relationship=id_atendimento`, `followupCutoff` igual ao manifesto e `otherFilters=none`. Conferir as OS dos atendimentos selecionados, não somente as OS concluídas em 01/10. Isso pode exigir conferir os vínculos nas consultas/relatórios Hubsoft, pois um relatório diário de conclusões sozinho não comprova o acompanhamento.

Na evidência de aprovação, adicionar `followup={"reportSha256":"HASH_DA_CONFERENCIA","ids":["IDS_DAS_OS_VINCULADAS"]}`. Os IDs são `id_ordem_servico`, não números exibidos da OS. Atendimentos sem OS são conferidos pela cobertura exata dos IDs de atendimentos. Para continuidade automática da fase C, fornecer também `monthReports[MES].followup.ids`. Divergência em qualquer população reverte toda a publicação, inclusive produção, na mesma transação.

O worker verifica quantidade declarada de OS contra a lista recebida quando a quantidade é fornecida. Lista ausente sem quantidade zero explícita, lista incompleta, ID duplicado ou pai divergente pausam a carga e preservam o checkpoint. As três conferências são independentes; os totais anteriores de outubro (1.267 atendimentos e 566 OS) precisam ser reconfirmados com **cadastro de atendimento e conclusão de OS**, antes de serem usados como referência. Não forçar esses números se o relatório anterior usava outro campo de data.

Os dados são gravados em `history_pages`, `history_clients` e `history_records`, separados dos indicadores publicados. Cada página é capturada uma vez e os complementos ficam persistidos. O nome de abertura e os vínculos de OS são procurados por cliente distinto e dia de abertura; diferentes atendimentos do mesmo cliente mantêm nomes distintos. A rota de cliente cheia (50 itens) pausa com `HUBSOFT_CLIENTE_PAGINACAO_NAO_CONFIRMADA`, pois não há contrato validado para navegar além do limite. Não existe fallback automático por protocolo na carga histórica. A exceção autorizada para o piloto diário de 01/10 é ativada explicitamente no job, conforme a seção acima.

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

Confirmar relatórios/filtros/corte do dia 1, paginação por cliente, OS sem programação, nomes retornados e capacidade de memória da consolidação. Se a carga receber uma exclusão dentro do mês alvo, pausa com `EXCLUSAO_EXIGE_RECONCILIACAO`: não ignora a divergência nem apaga registros anteriores automaticamente. Esse caso requer regra validada com o relatório antes de liberar a carga maior. O worker tem limite próprio de memória/CPU; esse isolamento não substitui monitorar host e PostgreSQL compartilhado. Não foi implementada uma coleta automática de métricas do host remoto: o piloto precisa de monitoramento operacional. Métricas acumuladas e staging devem ter retenção definida antes de cargas recorrentes. A sincronização diária automática é etapa posterior; não foi agendada.
