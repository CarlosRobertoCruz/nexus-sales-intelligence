# Lotes históricos de 2026

Preparação offline. Nenhuma chamada real é iniciada por build, deploy, `plan`, `create` ou abertura do painel. A autorização de lotes de até dois meses foi dada em 09/11/2026. A escolha dos meses deve constar no manifesto; o exemplo janeiro/fevereiro não inicia nem define uma carga real.

## Regras

- `phase=history`, `months` com um ou dois meses consecutivos, em ordem crescente, entre janeiro e setembro de 2026. Não há mais seleção implícita dos nove meses.
- Outubro deve constar como concluído/aprovado no PostgreSQL. O job de outubro permanece inalterado.
- Uma chamada por vez, 1 req/s, gate e OAuth compartilhados, 429 com espera e checkpoints preservados. O teto é **5000 chamadas para o lote inteiro**, incluindo OAuth, paginação, detalhes e retomadas. Atingi-lo pausa; não aumentar automaticamente.
- Cada mês usa seu relatório de atendimentos por **Data de Cadastro** e OS por **Data de Término Executado**, do primeiro ao último dia. Tipo de endereço Instalação, sem filtros adicionais de status, tipo, pessoa, vendedor ou localidade.
- Publicação manual após reconciliar cada mês. Espera persistida de cinco minutos antes de coletar o seguinte. Não executa os dois meses em paralelo nem aprova o segundo junto com o primeiro.
- O acompanhamento de OS futuras é observacional e separado da produção. Pendências nessa referência não dispensam a reconciliação da produção. OS iniciadas em mês anterior podem exigir recuperar seus atendimentos de contexto; não classificar vendas sem o vínculo correto.
- Divergências técnicas/checklists precisam de evidência própria do novo relatório. Não copiar exclusões, hashes, listas ou totais de outubro para outro mês.
- Protocolo exige `enable-history-protocol UUID`, vinculado somente ao job, meses e corte. Pode ser habilitado enquanto planejado para evitar repetir a consulta por cliente já diagnosticada como inadequada. Não herda a exceção de outubro.

## Preparar no Windows

São necessários **quatro relatórios para dois meses**: dois de atendimentos e dois de OS. Cada arquivo deve conter apenas o mês correspondente, completo, com os filtros acima. Não juntar os dois meses numa única planilha. Os ZIPs originais podem ser usados sem extração.

Copiar `deploy/history-batch-config.example.json` para uma pasta privada em `tmp`, ajustar meses/caminhos, data real da exportação e corte de acompanhamento. O preparador registra precisão de dia da exportação, sem inventar hora. Usa Python com `openpyxl`:

```powershell
python scripts/prepare-hubsoft-batch.py --config tmp/lote-config.json --output tmp/lote-preparado
```

A pasta de saída deve ser nova. O script verifica chaves, datas e limites, gera hashes dos XLSX originais, manifesto, referências e rascunhos de evidência por mês. Não altera as planilhas, não inclui relatos de clientes e não aprova nada. Se o filtro escolhido no sistema Hubsoft não puder ser confirmado pelos campos exportados, conferir a tela do relatório antes da execução.

## Atualizar e planejar na VPS

Depois do merge, reconstruir a imagem **api** e atualizar o serviço API. A imagem de `history` usa a mesma tag. Não requer migração. Não executar `down`, apagar workers, caches ou o job de outubro.

Enviar o pacote preparado por SCP para uma pasta privada específica do lote. No Bash da VPS:

```bash
cd /home/lab/projetos/nexus-sales-intelligence
dc() { docker compose --env-file .env.vps -f compose.vps.yml "$@"; }

# Arquivos privados entram pelo stdin; não depende de UID ou rótulo do volume.
batch_file() {
  local action="$1" input_file="$2"
  shift 2
  dc run --rm --no-deps -T --interactive \
    -e HUBSOFT_HISTORY_ENABLED=true -e HUBSOFT_HISTORY_IP_COORDINATED=true \
    -e HUBSOFT_REQUESTS_PER_SECOND=1 \
    --entrypoint sh history -c '
      set -eu
      history_input=$(mktemp /tmp/history-input.XXXXXX)
      cat > "$history_input"
      exec node server/jobs/import-year.mjs "$@" "$history_input"
    ' batch-file "$action" "$@" < "$input_file"
}

# Defina LOTE_DIR com o diretório real do pacote enviado.
batch_file plan "$LOTE_DIR/manifest.json"
```

Conferir meses, dias, corte, teto total de chamadas e `enabled=false`. `plan` não precisa de credenciais Hubsoft habilitadas. Depois criar uma única vez:

```bash
batch_file create "$LOTE_DIR/manifest.json"
```

Guardar o UUID retornado como `LOTE_ID`. O script de aprovação e os comandos de início abaixo alteram o estado no banco; executá-los somente para o lote planejado e conferido.

```bash
batch() {
  dc run --rm --no-deps \
    -e HUBSOFT_HISTORY_ENABLED=true \
    -e HUBSOFT_HISTORY_IP_COORDINATED=true \
    -e HUBSOFT_REQUESTS_PER_SECOND=1 history "$@"
}
batch enable-history-protocol "$LOTE_ID"
batch start "$LOTE_ID"

dc run --detach --no-deps \
  -e HUBSOFT_HISTORY_ENABLED=true \
  -e HUBSOFT_HISTORY_IP_COORDINATED=true \
  -e HUBSOFT_REQUESTS_PER_SECOND=1 history run "$LOTE_ID"
batch status "$LOTE_ID"
```

Não iniciar dois workers para o mesmo lote. Em `awaiting_validation`, o worker termina e o mês aguarda conferência. `status` mostra `months`, `current_month`, `month_totals`, chamadas e erros. Não usar `start` para contornar a validação.

```bash
batch reconcile "$LOTE_ID"
```

Conferir conjuntos de chaves, filtros, qualidade e divergências. Ajustar a evidência daquele mês após revisão, informando revisor e confirmação. Não transformar rascunho em aprovado automaticamente nem forçar totais esperados.

```bash
# EVIDENCIA é o arquivo aprovado do mês corrente, dentro de LOTE_DIR.
batch_file approve "$LOTE_DIR/$EVIDENCIA" "$LOTE_ID"
```

Após a primeira aprovação, reiniciar `history run` para o mesmo UUID. O worker respeitará os cinco minutos antes do segundo mês. Após a segunda aprovação, o lote fica `complete` e não alcança um terceiro mês. Lotes seguintes precisam de novo manifesto com os meses correspondentes; setembro pode ser um lote de um mês.
