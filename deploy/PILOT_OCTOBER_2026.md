# Piloto Hubsoft de outubro de 2026

Análise dos relatórios fornecidos em 29/10/2026. Nenhuma consulta à Hubsoft nem carga na VPS foi executada para esta análise.

## Dia escolhido

**01/10/2026** substitui 15/10 como base do piloto: 107 atendimentos cadastrados, de 93 clientes distintos, e 16 OS concluídas, totalizando 123 registros nas duas populações. O critério é o maior volume combinado encontrado nos arquivos em dia completo, com desempate por atendimentos e depois data. A soma é uma medida de volume da amostra, não uma contagem de ações únicas ou de vínculos. Esse dia também é o maior pico de abertura de atendimentos. A referência de 16 OS é parcial porque o arquivo foi filtrado por cadastro, não por conclusão; não garante o total de OS que a API deve retornar nesse dia.

| Dia | Atendimentos por cadastro | OS por conclusão | Volume combinado |
| --- | ---: | ---: | ---: |
| 01/10/2026 | 107 | 16 | 123 |
| 05/10/2026 | 90 | 21 | 111 |
| 28/10/2026 | 77 | 31 | 108 |
| 15/10/2026 | 75 | 28 | 103 |
| 26/10/2026 | 76 | 23 | 99 |

O maior volume diário de conclusões de OS é 31, com empate em 08/10, 14/10 e 28/10. Portanto, o dia escolhido é o pico combinado e de atendimentos, não o maior pico isolado de OS. O dia 29 foi excluído do ranking de dias completos porque a exportação foi feita durante esse dia. Outubro ainda não está fechado.

## Conferência dos arquivos

- Atendimentos: **1.402 registros**, com protocolos únicos. Uma linha final de rodapé, sem protocolo válido e sem datas, foi desconsiderada.
- OS: **635 registros**, com números de OS únicos. Uma linha final de rodapé, sem número válido e sem datas, foi desconsiderada.
- Das OS, 526 têm conclusão e status `finalizado`, 90 estão `pendente` e 19 `aguardando_agendamento`. As 109 sem conclusão não contam como produção concluída.
- O arquivo de OS inclui programação até 16/11/2026. Seu total não pode ser tratado como total de conclusões de outubro. Contar produção por `data_termino_executado`, combinada com a coluna de hora correspondente quando for necessário um timestamp.
- Os dois arquivos contêm registros até 29/10, incluindo o dia corrente incompleto. Não comparar seus totais com um fechamento mensal nem forçar os antigos totais de 1.267 atendimentos e 566 OS sem reconfirmar período e filtros.

## Amostra e acompanhamento

O modelo do manifesto foi ajustado para `peakDay=2026-10-01`, `cutoff=2026-10-01`, `osDateField=data_termino_executado` e `followupCutoff=2026-10-28`. A referência de acompanhamento é o último dia completo anterior à exportação. Status atuais são observados na captura, não reconstrução do status histórico em 28/10.

Há **25 referências textuais explícitas a OS** nas descrições dos atendimentos abertos em 01/10 que encontram números de OS no outro arquivo. Dessas referências, 10 apontam para conclusões em 01/10 e 15 para conclusões posteriores, até 28/10. Isso demonstra a necessidade do acompanhamento separado da produção. Essas referências são apenas diagnóstico: não substituem o vínculo nativo `id_atendimento`, não comprovam a lista completa e não são usadas como autorização para atribuir OS ao cliente ou atendimento por semelhança.

## Filtros confirmados e preparação

O usuário confirmou Data de Cadastro entre 01/10 e 31/10 para ambos os relatórios, sem outros recortes selecionados. No print de Atendimentos, Tipo de Endereço = Instalação é a opção padrão e Tipo de Atendimento está sem seleção. Registrar a escolha de endereço separadamente, sem confundi-la com o tipo de tarefa/atendimento ou presumir que seja o parâmetro `destino` da API.

A exportação de OS por cadastro pode omitir OS cadastradas em setembro e concluídas em 01/10. Portanto, 16 é a referência encontrada no arquivo enviado, não um total garantido de conclusões. A conferência automática bloqueia a publicação com `ESCOPO_RELATORIO_NAO_COMPARAVEL` até haver referência do mesmo universo de conclusões, mesmo se esses 16 números coincidirem.

Foi implementado o mapeamento por `protocolo -> id_atendimento` e `numero_ordem_servico -> id_ordem_servico`, sem necessidade de obter IDs manualmente. O preparador local gera manifesto e referências a partir dos ZIPs originais, preservando hashes, selecionando 107 protocolos e 16 números e descartando os rodapés. Não inclui dados pessoais na saída.

O manifesto do piloto pode ser validado para coleta com a referência de acompanhamento declarada como pendente. Isso permite capturar os vínculos no staging, exportá-los para revisão e executar a conferência local. Publicação continua bloqueada enquanto faltar a conferência independente dos vínculos, ou enquanto a referência por cadastro não comprovar o universo de conclusões. Uma lista produzida pela própria API não é tratada como conferência independente.

As evidências são preparadas sem aprovação (`reviewer=null`, `confirmFilters=false`). A implementação não iniciou worker, alterou flags ou consultou a API real. A fase de outubro completo continua dependendo do fechamento do mês e da validação do piloto.

## Fontes e rastreabilidade

Atendimentos: `relatorio-de-atendimentos-20261029143131-1-1.xlsx`, aba `sheet1`, SHA-256 `a32f1d55bb55bc36495733fdeecab62899fca693ddb72d96094e5c09854fe0c8`. Colunas usadas para seleção: `protocolo` e `data_cadastro`.

OS: `relatorio-de-ordens-de-servico-20261029142714-1-1.xlsx`, aba `sheet1`, SHA-256 `27a22107ee687fd31720d7e34ac6740048fd096b0811293381393c8b8b2aad8f`. Colunas usadas para seleção: `numero_ordem_servico`, `data_termino_executado` e `status`. Os arquivos originais e dados pessoais não foram copiados para arquivos versionados do projeto.
