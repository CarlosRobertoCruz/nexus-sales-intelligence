# API Contract

Cobre `src/api/*` — fronteira HTTP crua entre o app e o backend (`agente/`, porta 5055; o
navegador nunca fala direto com `app/server`, porta 5056, só o `agente/` fala com ele por dentro).

**Estrutura (23/07)** — mesmo espelho de `apps/onu/` vs `apps/layout/` vs `apps/visaoGeral/`,
sem pasta vazia preventiva (as três já nascem com arquivo real):

```txt
api/
  onu/         # tudo relacionado a ONU: apiShared.ts, detectBrand.ts, onuXxx.ts (14 arquivos)
  layout/      # tudo relacionado ao chrome do site: agentStatus.ts, clientSearch.ts
  visaoGeral/  # frota agregada (dashboard "Visão Geral"): visaoGeral.ts (GET /api/overview)
  equipamentos/  # catálogo por marca/modelo: equipamentos.ts (GET /api/equipamentos)
```

Import de fora de `api/` sempre pelo caminho completo (`@/api/onu/onuWifi`,
`@/api/layout/clientSearch`, `@/api/visaoGeral/visaoGeral`) — a raiz `api/` não tem arquivo
próprio, só as subpastas por área de domínio.

---

## Responsabilidade

- Só `fetch` + shape de DTO. Nenhuma decisao de negocio, nenhuma formatacao de apresentacao.
- Um arquivo por area de dominio de API (`onuWifi.ts`, `onuBackup.ts`, `clientSearch.ts`, etc.) —
  nunca por feature de UI. `api/onu/` e `api/layout/` sao layers compartilhados entre features,
  como `core/` — nao viram pasta de feature (sem `ui/`/`controller/`/`domain/` aqui).
- DTOs nomeados com sufixo `Dto` — sao o shape CRU vindo do backend, nao os tipos canonicos de
  dominio (esses vivem em `feature/types`/`core/types`/`@/apps/onu/types`, resolvidos pelo
  `services` que chama esta camada).

## Pode importar

- `./apiShared` (helpers e tipos compartilhados entre arquivos de `api/` — `postActionApi`,
  `OnuWriteResultDto`, `OnuActionConfirmationDto`, `OnuBandKeyDto`, etc.)
- **Exceção (22/07) — endpoint composto pode importar só TIPO (nunca função) de outro arquivo de
  domínio dentro de `api/`.** Ex.: `onuDetail.ts` (endpoint `/api/onu/detail`, que agrega
  identity+summary no mesmo payload) importa `type { OnuIdentityDto }` de `onuIdentity.ts` e
  `type { OnuSummaryDto }` de `onuSummary.ts`; `onuCapturas.ts` (endpoint de captura histórica que
  embute um summary completo) importa `type { OnuSummaryDto }` de `onuSummary.ts`. Motivo: o
  endpoint real agrega dois shapes já donos de arquivo próprio — duplicar o DTO (às vezes 200+
  linhas) criaria 2 fontes de verdade do mesmo shape que podem divergir silenciosamente; reusar o
  tipo é mais seguro que copiar. Só tipo, nunca `import` de função/valor — isso continua proibido
  (endpoint composto não chama a função do outro arquivo, só reaproveita o shape do payload).

Nada mais. Sem `garden/utils`, sem `feature/types`, sem `core/types`, sem React.

## Nao pode importar

- UI, controller, domain, services (o sentido e sempre `services -> api/`, nunca o contrario —
  ver `00-architecture.md`/`40-services.md`, "Service e a unica fronteira com `@/api/*`").
- `garden/foundations`, TOKENS.
- Qualquer `feature/types`/`core/types` — DTO e shape proprio de `api/`, nao herda tipo de
  dominio.

## Regras

- Nome de funcao: `fetchXxxApi` pra leitura (GET), `xxxApi`/`setXxxApi` pra acao de escrita
  (POST) — sempre sufixo `Api`.
- Escrita (POST) usa o helper compartilhado `postActionApi<T>(path, body, prefix)` de
  `apiShared.ts` — nao reimplementar fetch+tratamento de erro na mao pra cada acao nova.
- Leitura (GET) faz fetch cru; se `!response.ok`, lanca `Error` com prefixo
  `"<arquivo>: <mensagem> (<status>)"`. Preferir ler `payload?.error?.safe_message` do corpo de
  erro estruturado do backend antes de cair no fallback generico (padrao ja usado por
  `onuLogs.ts`/`onuBackup.ts`) — achado 22/07 (auditoria formal desta pasta) corrigido em 7
  arquivos que ainda so jogavam mensagem generica sem ler o corpo do erro.
- `apiShared.ts` e a unica excecao que outro arquivo de `api/` pode importar de dentro da propria
  pasta. Nenhuma camada fora de `api/` deve importar `apiShared.ts` direto (comentario de topo do
  proprio arquivo ja avisa isso) — sempre pelo arquivo de `api/` especifico da area.
- `api/` nunca decide o que fazer com o erro (toast, log, retry, redirecionar) — isso e do
  `service`/`controller` que chama esta camada.
- Sem `any`. Tipar o corpo da resposta (`as XxxDto`/`as { campo: Tipo }` explicito).
- Comentario de topo de arquivo: uma linha dizendo o que a fronteira cobre (ex. "Fronteira HTTP
  de leitura e escrita de configuracao Wi-Fi da ONU"), mais uma linha "Unico ponto de entrada
  para `/api/onu/wifi/*`" quando fizer sentido.

---

## Regra Suprema

Se qualquer sugestao conflitar com este contrato: seguir o contrato.
