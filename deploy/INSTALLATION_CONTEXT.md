# Atendimentos anteriores usados como contexto das vendas

A conferência de outubro identificou 49 OS de instalação finalizadas, mas 46 vendas no Sales. As três OS restantes já estavam publicadas; seus atendimentos vinculados não estavam na base publicada. Os protocolos foram recuperados dos snapshots locais do próprio job, sem nova consulta à Hubsoft. As datas de abertura e demais campos ainda precisam ser confirmados na resposta do detalhe.

O procedimento abaixo é restrito ao job aprovado de outubro `65a3be4d-9fe8-4ded-82c9-7497260b90bf`, às três OS indicadas no arquivo local e a atendimentos de setembro. Não inicia a fase histórica de janeiro a setembro, não percorre meses, não amplia a exceção do worker histórico e não reabre o job concluído.

## Como funciona

- `plan` lê o banco e confere o escopo: job concluído/aprovado, mês publicado e OS finalizadas de instalação com execução válida em outubro. Não consulta a Hubsoft.
- Se `codigo_cliente` estiver vazio na OS publicada, o plano procura a identidade do cliente nos snapshots processados de OS do próprio job. Confere ID, número da OS, atendimento e protocolo quando presente. O campo `cliente` pode conter o código delimitado antes do nome (por exemplo, `(9034) Nome` ou `9034 - Nome`). Códigos conflitantes, rótulos não reconhecidos e ausência de evidência bloqueiam a recuperação. O plano informa `clientRecoveredFromSnapshot`, sem gravar dados.
- `capture` consulta cada protocolo exato com `limit=1`, uma chamada por vez, usando `HubsoftClient` e o gate PostgreSQL a 1 req/s. Reutiliza o token válido; OAuth só quando necessário. Compartilha cooldown, política de 429 e orçamento acumulado de 5.000 chamadas do job. Não aumenta esse orçamento nem faz tentativas em loop.
- O detalhe precisa corresponder ao ID do atendimento, protocolo e cliente da OS. A abertura efetivamente retornada deve ser em setembro de 2026, anterior ou no dia da execução. Tipo de atendimento de instalação, descrição e usuário de abertura são obrigatórios. Dados excluídos/incompletos ou identidade divergente bloqueiam a etapa.
- Cada detalhe validado fica minimizado em `application_settings`, com a identidade da OS e assinatura dos campos de vínculo/execução. Não são guardados CPF, telefone, email ou credenciais. Se a próxima consulta falhar, o cache já validado permanece para retomada.
- `apply` não consulta a API. Revalida as três OS e os caches antes de aplicar tudo em uma transação. Uma falha reverte também os contextos anteriores dessa aplicação e os indicadores.
- Somente após a confirmação do mesmo cliente no detalhe do atendimento, `apply` preenche o `codigo_cliente` ausente nas OS alvo, na mesma transação dos contextos e indicadores. Preserva os demais campos da OS, as páginas originais, o staging histórico e a reconciliação aprovada. Não atualiza em massa outras OS.
- Os atendimentos recebem `publication_scope=installation_context`, mantendo seus IDs e datas originais com precisão diária. Eles só podem fundamentar as OS expressamente vinculadas e do mesmo cliente. Não geram volume de atendimento, renovação, cancelamento ou um período parcial de setembro. A conclusão da OS continua definindo o mês da venda.
- Repetir o procedimento não duplica dados nem refaz detalhes já validados. Consulta manual não sobrescreve contexto validado. Quando setembro for integralmente aprovado, o upsert pelo mesmo ID substitui o contexto pela publicação normal; uma aplicação de contexto não rebaixa um registro já publicado normalmente.

## Deploy e execução

Commit/push/merge, testes verdes e build de **API e web** são necessários, pois a classificação é compartilhada. Não há migração nova. Ainda não foi feita consulta real nem aplicação na VPS por esta implementação.

O arquivo privado já preparado localmente é `tmp/hubsoft-october-2026-r1/installation-context.json`. Ele contém somente o job, os meses e os três pares de identidades informados pelo usuário. Não é versionado. Não substitui o manifesto nem as referências aprovadas de outubro.

Depois do deploy, enviar pelo **PowerShell local**, na pasta do Sales:

```powershell
scp ".\tmp\hubsoft-october-2026-r1\installation-context.json" "vps-lab:/home/lab/pilotos/sales-2026-10/"
```

No **terminal da VPS**:

```bash
cd /home/lab/projetos/nexus-sales-intelligence
chmod 600 /home/lab/pilotos/sales-2026-10/installation-context.json
dc() { docker compose --env-file .env.vps -f compose.vps.yml "$@"; }
ctx() {
  dc run --rm --no-deps -T --interactive \
    -e HUBSOFT_HISTORY_ENABLED=true \
    -e HUBSOFT_HISTORY_IP_COORDINATED=true \
    -e HUBSOFT_REQUESTS_PER_SECOND=1 \
    --entrypoint sh history -c '
      set -eu
      manifest=$(mktemp /tmp/installation-context.XXXXXX)
      cat > "$manifest"
      exec node server/jobs/installation-context.mjs "$@" "$manifest"
    ' ctx "$@" < /home/lab/pilotos/sales-2026-10/installation-context.json
}

ctx plan
```

O shell da VPS lê o JSON protegido e o envia pela entrada padrão. O contêiner conserva o usuário `node` da imagem, que tem acesso aos scripts em `/app`, e recebe o JSON em um arquivo temporário privado no `/tmp` em memória. Esse arquivo desaparece com o contêiner. Não usar `--user "$(id -u):$(id -g)"` aqui: arquivos da imagem pertencentes a `node` podem não ser legíveis pelo UID do usuário `lab`. Não é necessário ampliar as permissões do arquivo nem montar a pasta de entrada.

Conferir os três alvos e `maximumDetailQueries=3`. Depois:

```bash
ctx capture
```

O resultado deve mostrar `ready=true` e `published=false`. Essa etapa ainda não altera indicadores. Não continuar se houver erro de identidade, qualidade, limite ou snapshot divergente. Corrigir a causa preservando os checkpoints; um 429 respeita o cooldown e encerra a tentativa atual.

Após conferir a captura, a aplicação explícita é:

```bash
ctx apply
```

O resultado apresenta as contagens de outubro recalculadas na mesma transação. O esperado, se os três detalhes confirmarem os vínculos, é 49 vendas e 184 renovações; o volume de atendimentos de outubro e os demais indicadores não recebem os atendimentos contextuais de setembro. O job e a reconciliação mensal aprovada permanecem intactos.

Conferir depois na VPS:

```bash
docker exec lab-postgres psql -U lab -d lab -P pager=off -c "
SELECT kind, count(*) AS registros
FROM nexus_sales_intelligence.commercial_records
WHERE event_date >= '2026-10-01 00:00:00-03'::timestamptz
  AND event_date < '2026-11-01 00:00:00-03'::timestamptz
GROUP BY kind ORDER BY kind;
"
```

Atualizar o navegador e selecionar outubro. Não executar novamente `history create`, `start`, `run` ou `approve` para este reparo de vínculos.
