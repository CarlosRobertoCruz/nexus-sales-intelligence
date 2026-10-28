# Regras da integracao Hubsoft

Estas regras se aplicam a todo o projeto e a qualquer implementacao, teste ou execucao da integracao.

## Credenciais
- Nunca exibir, registrar em logs, copiar para exemplos ou versionar valores do .env.
- Credenciais e tokens devem permanecer no backend; nunca incluir em codigo ou variaveis publicas do frontend.
- Nao abrir o .env para inspecao rotineira. Verificar configuracao apenas pela presenca das variaveis, sem mostrar valores.

## Somente leitura
- O usuario autoriza somente requisicoes HTTP GET para consultas na Hubsoft, com a unica excecao de autenticacao descrita abaixo.
- Nunca executar POST (exceto a autenticacao abaixo), PUT, PATCH, DELETE ou qualquer operacao que altere dados na Hubsoft, inclusive se exposta como GET.
- Nao executar consultas reais apenas por ter acesso as credenciais; a execucao deve fazer parte da tarefa autorizada.
- Excecao explicitamente autorizada pelo usuario: POST /oauth/token, exclusivamente para autenticacao OAuth na origem Hubsoft configurada em HUBSOFT_API_URL. Nenhum outro POST esta autorizado. Nao encaminhar credenciais para outra origem por redirecionamento.
- Reutilizar o token enquanto valido e autenticar novamente apenas quando necessario, respeitando limites e tentativas limitadas. Nunca registrar credenciais, corpo da autenticacao ou tokens em logs.
- Quando a integracao for implementada, impor estas restricoes no cliente HTTP centralizado. Este documento sozinho nao constitui uma protecao em tempo de execucao.

## Consultas limitadas
- Sempre usar paginacao explicita nos endpoints de listagem; nunca solicitar todos os registros em uma unica chamada.
- Padrao conservador: no maximo 50 registros por pagina e janela de consulta de no maximo 1 dia por vez.
- Processar uma pagina e uma janela por vez, sem paralelismo de consultas Hubsoft; ritmo constante de 1 req/s por padrao, configuravel ate 2 req/s, sem burst e com gate PostgreSQL compartilhado entre API e workers. Outros consumidores no IP devem ser coordenados antes do piloto.
- Nao iniciar varreduras de muitos dias nem percorrer automaticamente todo o historico. Importacoes historicas exigem escopo e periodo explicitamente definidos pelo usuario.
- Aplicar limite de paginas por execucao, timeout, tentativas limitadas e checkpoints para permitir retomada sem repetir consultas desnecessarias.
- Respeitar rate limits e Retry-After/retry_after. Em 429, aguardar conforme a API; nunca insistir em loop imediato.
- Consultas recorrentes devem ser incrementais e evitar recarregar todo o historico; nao sincronizar a cada abertura de tela.
- Testes comuns devem usar dados simulados, sem acessar a API real.

## Pontos de implementacao
- server/hubsoft.mjs centraliza a lista de metodos e rotas permitidos e bloqueia redirecionamentos.
- server/sync.mjs limita cada execucao a 4 chamadas GET no total de um unico dia, incluindo consultas complementares por protocolo, e persiste checkpoints no PostgreSQL. A resolucao de nomes de uma pagina pendente fica no banco local para retomada; a pagina so avanca quando todos os registros forem validos.
- Testes em server/tests usam respostas simuladas e PostgreSQL embarcado. Nunca substituir os mocks por chamadas reais sem uma tarefa explicitamente autorizada.
- deploy/README.md documenta configuracao, mapeamento de usuarios Hubsoft, migracoes e deploy. Credenciais nao devem aparecer em saidas de revisao.

## Carga historica de 2026
- server/jobs/import-year.mjs oferece planejamento offline e execucao opt-in; nenhuma carga e iniciada por deploy ou abertura do painel.
- Execucao real exige HUBSOFT_HISTORY_ENABLED=true e HUBSOFT_HISTORY_IP_COORDINATED=true, manifesto e relatorios; nao habilitar essas flags em testes.
- Sequencia aprovada: dia de pico de outubro, outubro fechado e reconciliado, depois janeiro a setembro. Cada fase depende da validacao anterior, com pausa minima persistida de 5 minutos entre meses.
- Upsert por IDs canonicos; OS embutidas e diretas sao deduplicadas. A rota propria de OS continua obrigatoria.
- Enriquecimento historico por codigo_cliente distinto e dia de abertura, nunca um unico nome por cliente. Se a consulta por cliente retornar 50 itens sem navegacao confirmada, pausar; nao truncar nem recorrer automaticamente por protocolo.
- A sincronizacao manual anterior conserva seu limite de quatro GETs e usa o mesmo gate. Os testes de compatibilidade antigos podem exercitar seu complemento legado por protocolo; o script historico nao o utiliza.
- 429 persiste cooldown e politica; token protegido e compartilhado ate expires_in ou 401. Leituras externas continuam restritas a GET e OAuth POST.
- Limite de 50 mil registros preservado; datas de atendimento sem hora inventada; filtro de OS precisa coincidir com os relatorios. Nenhuma necessidade de aprovacao adicional de administrador Hubsoft; acesso negado e um impedimento tecnico.
