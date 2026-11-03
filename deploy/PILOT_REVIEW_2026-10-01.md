# Conferência pendente do piloto de 01/10/2026

Job: `8a55cdb3-eead-4288-b74b-aab99ad24b71`. Este documento registra observações fornecidas pelo usuário, não aprova a publicação e não altera a Hubsoft.

## Diferença de OS documentada

O relatório por Data de Término Executado, de 01/10 a 01/10, tem 23 OS únicas. As 16 coletadas estão presentes. Das 7 restantes, 6 são checklists de veículos excluídas dos indicadores comerciais por confirmação do usuário.

A OS `037226260134210040` é `(SFN) SUPORTE`, destino `SFNCONSULT`. As telas de listagem e detalhe fornecidas pelo usuário mostram abertura em 17/09/2026 às 13:42:10 e fim executado em 01/10/2026 às 09:17:45. Seu fechamento descreve atendimento de botoeira digital. Não é uma instalação, retirada/cancelamento ou reativação comercial de cliente/serviço do Sales. Nenhum endereço, nome de cliente ou funcionário foi reproduzido neste registro.

A justificativa é pontual, vinculada ao número da OS. Não excluir automaticamente todo suporte, todo destino com nome semelhante ou toda OS sem cliente. Não mudar a data de conclusão para a data de cadastro. O relatório bruto permanece com 23 chaves e a coleta com 16; o resumo comercial separa as 6 checklists e essa OS de suporte, explicando a diferença. A existência dessa justificativa não transforma uma exportação geral em uma exportação filtrada por cliente/serviço, nem aprova a publicação.

A cópia local `references-reviewed.json`, em `tmp/hubsoft-pilot-2026-10-01/`, preserva os hashes e chaves anteriores e acrescenta apenas a justificativa em `scopeReview.reviewedOrders`. O resultado é `explained_not_approved` quando todas as diferenças estão justificadas. Os bloqueios de publicação permanecem explícitos, sem exigência de nova busca dessa mesma OS.

## Exportar as pendências da VPS sem consultar a API

Após o deploy da API, envie `references-reviewed.json` e anexe ao mesmo job. Não recriar manifesto ou job e não executar `start/run` novamente. O diretório montado para a referência deve permanecer somente leitura.

```bash
# PowerShell local, na pasta do Sales:
scp .\tmp\hubsoft-pilot-2026-10-01\references-reviewed.json vps-lab:/home/lab/pilotos/sales-2026-10-01/
```

```bash
# VPS, na pasta do Sales, com dc já definido:
chmod 600 /home/lab/pilotos/sales-2026-10-01/references-reviewed.json

dc run --rm --no-deps --user "$(id -u):$(id -g)" \
  -v /home/lab/pilotos/sales-2026-10-01:/entrada:ro,Z \
  history attach-reports 8a55cdb3-eead-4288-b74b-aab99ad24b71 /entrada/references-reviewed.json

# A pasta /saida/revisao-01 será criada pelo comando. Deve ainda não existir.
dc run --rm --no-deps --user "$(id -u):$(id -g)" \
  -v /home/lab/pilotos/sales-2026-10-01:/saida:rw,Z \
  history export-review 8a55cdb3-eead-4288-b74b-aab99ad24b71 /saida/revisao-01
```

O comando lê um snapshot PostgreSQL com transação somente leitura, não importa o cliente Hubsoft, não usa flags de carga e não modifica dados ou estado do job. Cria um diretório novo com permissões 700 e dois arquivos 600: `review.json` e `conferencia.md`. Não sobrescreve uma exportação anterior. Para repetir, use outro nome de diretório. Protocolos e números de OS permanecem strings, sem perda de zeros ou precisão. Não há nomes, telefones, documentos ou descrições de clientes. Os arquivos continuam privados e fora do Git.

```powershell
# Windows: baixar a conferência para encaminhar aqui.
scp -r vps-lab:/home/lab/pilotos/sales-2026-10-01/revisao-01 .\tmp\hubsoft-pilot-2026-10-01\
```

## Três atendimentos incompletos

O pacote lista os protocolos reais e os campos ausentes de cada atendimento; não deduz protocolos pela posição da página. Localizar os atendimentos na Hubsoft e conferir descrição e tipo. Registrar se os campos realmente estão vazios ou se o relatório/API deixou de retorná-los. Não inventar valores. A coleta continua válida para volume e os registros permanecem sem classificação comercial automática. Se for aceita uma publicação parcial, registrar a decisão e a confirmação explícita já exigida pelo fluxo. A lista exportada não confirma isso automaticamente.

## Quarenta e três vínculos

A lista de OS informa o protocolo do atendimento pai, IDs e número da OS, cadastro, início/fim executados, observação e enquadramento no corte de 28/10. A lista completa dos 107 atendimentos inclui os sem OS para evitar comprovar apenas os vínculos que já foram encontrados.

Na Hubsoft, conferir os atendimentos abertos em 01/10 e suas OS relacionadas, inclusive as concluídas nos dias seguintes, pendentes e canceladas. Não restringir conclusão ao dia 01/10. Uma referência independente pode ser relatório da origem com relacionamento explícito entre protocolo/ID de atendimento e OS; se o relatório padrão não trouxer esse relacionamento, registrar a conferência manual no detalhe de cada atendimento. Guardar a origem, data, corte e as divergências; não atribuir OS por nome de cliente.

O total de 43 corresponde à observação capturada na extração, não a uma reconstrução garantida do estado histórico em 28/10. Respeitar os registros criados ou concluídos após o corte e as situações sem data; não rotular retroativamente o status atual como status daquela data. Não usar `review.json`, `export-followup` ou listas copiadas do staging como fonte independente de aprovação.

## Encerramento e próxima fase

Ainda será necessário registrar a aceitação de escopo na publicação, o resultado da revisão dos campos e a evidência independente dos vínculos. A aprovação transacional atual não é relaxada por esta entrega: `publishable` continua falso enquanto os bloqueios existirem. Não avançar para outubro completo ou janeiro–setembro nesta etapa. Outubro fechado também exige que 31/10 tenha terminado. Nenhuma migração, consulta remota ou carga nova é necessária para gerar este pacote; somente reconstruir a imagem da API e exportar a leitura local.
