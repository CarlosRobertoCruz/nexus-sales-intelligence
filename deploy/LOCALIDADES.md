# Localidades comerciais

Os nomes de cobertura ficam em `src/core/config/commercialLocations.ts`. A lista foi fornecida pela equipe em 12/11/2026. Prefixos de pasta, contagens, acentos e aliases convergem para um nome. Cachoeira, Cunhambe e Cunhambebe são consolidados como Muriqui no mapa e no ranking, conforme orientação da equipe. Backbone2 é uma pasta técnica e não recebe ponto no mapa. Sahy sem indicação explícita permanece Sahy; não presumir Bairro ou Condomínios.

## Origem e identificação

O adaptador aceita bairro/cidade textuais ou objetos com nome/descrição no registro e no endereço de instalação, inclusive em cliente_servico. A projeção guarda somente os campos geográficos necessários e a identidade do serviço. O complemento por protocolo pode preencher campos ausentes da outra resposta validada; divergência entre IDs de serviço não é mesclada.

Para vendas, o bairro da OS de instalação vinculada ao atendimento e ao cliente tem prioridade. Em seguida são usados o endereço estruturado do atendimento, cidade e trechos explicitamente identificados como endereço. Menções em conversas e nomes de ruas não comprovam bairro. Centro/Muriqui (incluindo Cunhambebe)/Junqueira em outra cidade explícita não recebem coordenadas de Mangaratiba.

O mapa usa referências regionais aproximadas já cadastradas, sem coordenadas geradas para desconhecidos. Todos os aliases de Muriqui somam no ponto e no ranking Muriqui. Subdivisões do Sahy somam no ponto Sahy e mantêm seus nomes no ranking. Vendas sem localização continuam no total, com aviso separado, inclusive no PDF.

## Recuperar dados já importados

Este reparo é offline: não consulta a Hubsoft nem inicia nova coleta. Recupera apenas bairro/cidade disponíveis no cache local de atendimento por protocolo, validando ID do atendimento, protocolo, cliente, dia e IDs de serviço conhecidos. Campos existentes não são sobrescritos; caches conflitantes são reportados. Campos descartados antes de entrar no cache não podem ser reconstruídos por esta operação. Assim, normalizar nomes não garante identificar todos os registros antigos.

Depois do merge e deploy, API, web e worker automatic devem usar imagens construídas deste commit. Não há migração de banco nova. A recriação do worker usa os checkpoints existentes; não iniciar outro backfill nem apagar páginas/caches.

Na VPS, no diretório do Sales e com a função `dc` habitual, comece com a prévia:

```bash
dc run --rm --no-deps --entrypoint node history server/jobs/rebuild-locations.mjs plan 2025-10,2026-10
```

`plan` abre transação somente leitura, mostra totais e sem-localidade antes/depois, correspondências, divergências e quantidade de fontes a preencher. Aceita um ou dois meses explícitos desde janeiro/2025 até o mês atual. Os meses podem ser não consecutivos porque não há coleta externa. Não imprime nomes ou endereços de clientes.

Para aplicar o mesmo escopo:

```bash
dc run --rm --no-deps --entrypoint node history server/jobs/rebuild-locations.mjs apply 2025-10,2026-10
```

`apply` disputa sem espera o lock compartilhado com o coletor. Se retornar `SINCRONIZACAO_EM_ANDAMENTO`, não houve aplicação; tente depois de concluir a operação ativa. Não é necessário interromper a coleta para executar a prévia. A aplicação é transacional, registra hashes da evidência no banco e bloqueia qualquer diferença em atributos não geográficos dos indicadores publicados. Localizações publicadas fora dos meses pedidos são preservadas. Reexecuções não duplicam fontes/eventos.

Se o relatório continuar com muitos desconhecidos e nenhum cache aproveitável, o próximo diagnóstico precisa verificar a resposta real da origem por OS/serviço exato. Este patch não adiciona rotas de consulta de cliente nem dispara chamadas adicionais. Não preencher bairro por suposição, nem usar o endereço atual de outro serviço do mesmo cliente como endereço histórico da instalação.


## Recuperacao por servico exato (segunda etapa)

O diagnostico real de outubro/2026 encontrou 35 vendas com OS, atendimento e codigo do cliente, mas sem bairro e sem ID de servico normalizado. Isso nao comprova ausencia do endereco na Hubsoft. A documentacao do atendimento retorna `servico.id_cliente_servico`, agora lido e preservado; o cadastro do cliente retorna `servicos[].endereco_instalacao`.

Fontes oficiais: [atendimento](https://github.com/hubsoftbrasil/api/blob/master/docs/source/clientes/atendimento.rst) e [consulta de cliente](https://github.com/hubsoftbrasil/api/blob/master/docs/source/clientes/consulta.rst).

O novo comando e separado do reparo offline. Nao e iniciado por deploy, navegador ou worker automatico. Exige imagem nova da API e worker com o mesmo codigo. Nao ha migracao. A base nao tem teto acumulado por quantidade de linhas (50 mil por arquivo/lote permanecem); esta recuperacao atualiza fontes existentes, sem inserir outros atendimentos/OS.

Na VPS, comece pela previa rapida (somente leitura, sem reclassificar a base inteira):

```bash
dc run --rm --no-deps --entrypoint node history server/jobs/repair-service-locations.mjs plan 2026-10
```

Depois, o primeiro teste captura somente o que couber em quatro chamadas totais, incluindo eventual OAuth. Nao publica indicadores:

```bash
dc run --rm --no-deps --entrypoint node history server/jobs/repair-service-locations.mjs capture 2026-10 4
```

Uma captura consulta o protocolo exato ja vinculado a venda, valida atendimento, cliente, OS, numero e execucao, extrai o ID do servico, e consulta o cliente por codigo exato com limit=1. Dentre os servicos desse cliente, aceita somente o ID comprovado. Consulta o filtro de cancelados apenas se o ID nao apareceu no filtro inicial. Nunca escolhe o primeiro servico nem usa endereco de cobranca/fiscal. A resposta do cliente e reduzida imediatamente a ID, bairro e cidade; contatos, senhas e enderecos completos nao sao persistidos nem impressos.

Exige HUBSOFT_HISTORY_IP_COORDINATED=true, habilitacao historica ou automatica existente, e gate compartilhado de 1 req/s. Cada comando aceita de 4 a 100 chamadas, com teto persistido de 500 por escopo (um ou dois meses explicitos desde janeiro/2025). A reserva ocorre antes do envio, incluindo falhas e OAuth. 429 respeita cooldown; falhas interrompem a execucao. Identidades e evidencias concluidas ficam em checkpoints, evitando repetir protocolos apos interrupcao. O lock compartilhado evita concorrencia com captura/publicacao; ocupado retorna SINCRONIZACAO_EM_ANDAMENTO sem novas chamadas.

Se o piloto funcionar, continuar o mesmo escopo com ate 100 chamadas por execucao e conferir novamente:

```bash
dc run --rm --no-deps --entrypoint node history server/jobs/repair-service-locations.mjs capture 2026-10 100
dc run --rm --no-deps --entrypoint node history server/jobs/repair-service-locations.mjs plan 2026-10
```

**Limitacao historica:** o cadastro mostra o endereco de instalacao atual daquele servico, observado no momento da consulta. Nao comprova que o endereco nunca mudou desde a venda. A evidencia registra essa origem e data; a publicacao exige aceitar explicitamente essa base de endereco. Se a gestao exigir endereco imutavel na data da venda, manter a evidencia para conferencia e obter a fonte historica, sem executar apply.

Para aplicar as evidencias validas apos essa conferencia:

```bash
dc run --rm --no-deps --entrypoint node history server/jobs/repair-service-locations.mjs apply 2026-10 --accept-current-service-address
```

A aplicacao e transacional, verifica se a fonte mudou desde a captura, atualiza somente geografia/ID do servico da OS existente e o campo location da venda correspondente. IDs, datas, planos, atendentes, quantidades e outros meses permanecem intactos. Cidade/bairro existentes divergentes bloqueiam a aplicacao. Ha auditoria com hashes; reexecutar nao duplica eventos. O resultado real da primeira captura deve ser conferido antes de prometer que todos os 35 casos serao recuperados.

Uma listagem futura sem geografia preserva a evidencia recuperada somente quando IDs da OS/atendimento/cliente, numero da OS, execucao e eventual servico continuam iguais. Endereco ou servico explicito divergente nao herda a geografia anterior. Assim, o proximo rebuild nao apaga silenciosamente a recuperacao por receber uma resposta mais pobre.
