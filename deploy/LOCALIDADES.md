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
