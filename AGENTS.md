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
- Processar uma pagina e uma janela por vez, sem paralelismo de consultas Hubsoft; pausa minima de 1 segundo entre chamadas.
- Nao iniciar varreduras de muitos dias nem percorrer automaticamente todo o historico. Importacoes historicas exigem escopo e periodo explicitamente definidos pelo usuario.
- Aplicar limite de paginas por execucao, timeout, tentativas limitadas e checkpoints para permitir retomada sem repetir consultas desnecessarias.
- Respeitar rate limits e Retry-After/retry_after. Em 429, aguardar conforme a API; nunca insistir em loop imediato.
- Consultas recorrentes devem ser incrementais e evitar recarregar todo o historico; nao sincronizar a cada abertura de tela.
- Testes comuns devem usar dados simulados, sem acessar a API real.

## Pontos de implementacao
- server/hubsoft.mjs centraliza a lista de metodos e rotas permitidos e bloqueia redirecionamentos.
- server/sync.mjs limita cada execucao a 4 paginas GET de um unico dia e persiste checkpoints no PostgreSQL.
- Testes em server/tests usam respostas simuladas e PostgreSQL embarcado. Nunca substituir os mocks por chamadas reais sem uma tarefa explicitamente autorizada.
- deploy/README.md documenta configuracao, mapeamento de usuarios Hubsoft, migracoes e deploy. Credenciais nao devem aparecer em saidas de revisao.
