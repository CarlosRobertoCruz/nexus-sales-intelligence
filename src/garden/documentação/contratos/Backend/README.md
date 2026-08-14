# Contratos de Auditoria — Backend

> Versao 1.0 — Junho 2026
> Use esta pasta como roteiro para auditar modulos do servidor sem se perder.

---

## Estrutura padrao de modulo

```txt
app/server/src/modules/<modulo>/
  <modulo>.controller.ts   <- HTTP: valida, delega, responde, registra auditoria
  <modulo>.service.ts      <- regras de negocio e queries no banco
  <modulo>.routes.ts       <- mapeamento de rotas e middleware
  <modulo>.types.ts        <- opcional; interfaces do modulo
```

### Sempre existem

| Arquivo | Papel |
|---|---|
| `*.controller.ts` | Porta HTTP do modulo; nao decide negocio |
| `*.service.ts` | Nucleo logico; nao conhece HTTP |
| `*.routes.ts` | Indice de rotas; sem logica |

### Opcional

| Arquivo | Quando criar |
|---|---|
| `*.types.ts` | Quando interfaces crescerem fora do service |

---

## Ordem para auditar um modulo

1. **Types** — [`60-types.md`](./60-types.md)
   Contratos de dados corretos? Sem `any`?

2. **Service** — [`20-service.md`](./20-service.md)
   Regra de negocio isolada do HTTP? Sem `Request`/`Response`? Retorno tipado?

3. **Controller** — [`10-controller.md`](./10-controller.md)
   Tenant dinamico? Sem `pool` direto? Auditoria correta?

4. **Routes** — [`30-routes.md`](./30-routes.md)
   Middleware de auth aplicado? Sem logica?

5. **Migrations** — [`40-migrations.md`](./40-migrations.md)
   Numeradas? `IF NOT EXISTS`? Sem seed?

6. **Auditoria** — [`50-auditoria.md`](./50-auditoria.md)
   `canal` e `tenant` dinamicos? `.catch` presente?

7. **Checklist final** — [`02-checklist.md`](./02-checklist.md)
   Feche conformidade e pendencias.

---

## Contratos por camada

| Area | Contrato |
|---|---|
| Arquitetura geral | [`00-architecture.md`](./00-architecture.md) |
| Como auditar | [`01-review-guide.md`](./01-review-guide.md) |
| Checklist de PR | [`02-checklist.md`](./02-checklist.md) |
| `*.controller.ts` | [`10-controller.md`](./10-controller.md) |
| `*.service.ts` | [`20-service.md`](./20-service.md) |
| `*.routes.ts` | [`30-routes.md`](./30-routes.md) |
| `db/migrations/` | [`40-migrations.md`](./40-migrations.md) |
| `logAuditEvent` | [`50-auditoria.md`](./50-auditoria.md) |
| `*.types.ts` | [`60-types.md`](./60-types.md) |
