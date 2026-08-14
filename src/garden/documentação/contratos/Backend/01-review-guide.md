# Review Guide — Backend

> Versao 1.0 — Junho 2026
> Guia para auditar arquivo por arquivo sem misturar camadas.

---

## Como auditar

1. Identifique a camada do arquivo (`controller`, `service`, `routes`, `types`, `migrations`).
2. Leia o contrato correspondente.
3. Verifique imports antes de comportamento.
4. Verifique se o arquivo faz mais do que sua camada permite.
5. Feche com veredito: **conforme**, **quase conforme** ou **nao conforme**.

---

## Sinais de alerta imediato

| Sinal | Camada suspeita | Contrato violado |
|---|---|---|
| `pool.query` no controller | Controller | [`10-controller.md`](./10-controller.md) |
| `Request` ou `Response` no service | Service | [`20-service.md`](./20-service.md) |
| `logAuditEvent` no service | Service | [`20-service.md`](./20-service.md) |
| Logica de `if`/`switch` em routes | Routes | [`30-routes.md`](./30-routes.md) |
| `TENANT = "default"` hardcoded | Controller | [`10-controller.md`](./10-controller.md) |
| `canal: "WhatsApp"` hardcoded | Controller | [`50-auditoria.md`](./50-auditoria.md) |
| `tipo: "sistema"` para acao humana | Controller | [`50-auditoria.md`](./50-auditoria.md) |
| Migration editada sem nova migration | Migrations | [`40-migrations.md`](./40-migrations.md) |
| `any` em service ou controller | Qualquer | [`60-types.md`](./60-types.md) |
| Auditoria sem `.catch` | Controller | [`50-auditoria.md`](./50-auditoria.md) |

---

## Ordem de auditoria de um modulo

1. `*.types.ts` — contratos de dados corretos?
2. `*.service.ts` — regra de negocio isolada do HTTP?
3. `*.controller.ts` — tenant e auditoria corretos? sem pool direto?
4. `*.routes.ts` — auth aplicado? sem logica?

---

## Veredito por arquivo

Ao fechar a revisao de cada arquivo, registre:

- **Conforme** — nenhuma violacao de contrato.
- **Quase conforme** — desvio intencional documentado no codigo.
- **Nao conforme** — violacao clara sem justificativa; bloqueia merge.

---

## Promocao de codigo

| Situacao | Acao |
|---|---|
| Logica util repetida em 2+ controllers | Extrair para o service |
| Tipo repetido em 2+ modulos | Promover para `app/server/src/types/` |
| Query repetida em 2+ services | Extrair funcao no service de origem ou criar service compartilhado |
