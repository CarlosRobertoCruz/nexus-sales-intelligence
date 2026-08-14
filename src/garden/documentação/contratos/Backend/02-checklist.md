# Checklist de Conformidade — Backend

> Versao 1.0 — Junho 2026
> Documento operacional para PR e auditoria por camada.
> Marque apenas os blocos tocados pela mudanca; o resto fica N/A.

---

## A. Controller

- [ ] **A1** — Nao importa `pool` diretamente.
- [ ] **A2** — Nao contem regra de negocio ou query SQL.
- [ ] **A3** — Tenant extraido via `tenant(req)` — sem `"default"` hardcoded.
- [ ] **A4** — Validacao de input presente antes de chamar o service.
- [ ] **A5** — Resposta HTTP com status code correto (`200`, `201`, `400`, `404`, etc.).

## B. Auditoria

- [ ] **B1** — `logAuditEvent` chamado apos acao bem-sucedida, nao antes.
- [ ] **B2** — `tipo` correto: `"usuario"` para humano, `"sistema"` para automacao, `"bot"` para IA.
- [ ] **B3** — `responsavel` via `resolveResponsavel(req.headers)` — sem string literal.
- [ ] **B4** — `canal` dinamico — sem string hardcoded.
- [ ] **B5** — Segundo argumento e `tenant(req)` — sem `"default"` literal.
- [ ] **B6** — Chamada com `.catch` para nao bloquear resposta HTTP.

## C. Service

- [ ] **C1** — Nao importa `Request`, `Response` ou `NextFunction`.
- [ ] **C2** — Nao chama `logAuditEvent`.
- [ ] **C3** — Retorno tipado — sem `any` em funcoes publicas.
- [ ] **C4** — Operacoes de criacao verificam duplicatas quando necessario.
- [ ] **C5** — Nao expoe `pool` diretamente para fora do modulo.

## D. Routes

- [ ] **D1** — Nenhuma logica de validacao ou negocio no arquivo.
- [ ] **D2** — Middleware de auth presente em todas as rotas protegidas.
- [ ] **D3** — Rotas publicas intencionais com comentario explicativo.

## E. Migrations

- [ ] **E1** — Numeracao sequencial correta.
- [ ] **E2** — `IF NOT EXISTS` em todo DDL para idempotencia.
- [ ] **E3** — Nao contem dados de seed.
- [ ] **E4** — Nao altera migration ja aplicada — criou nova quando necessario.
- [ ] **E5** — Nome descritivo do que muda.

## F. Types

- [ ] **F1** — Sem `any` em interfaces publicas.
- [ ] **F2** — Tipos do Express ausentes fora do controller.
- [ ] **F3** — Tipo repetido em 2+ modulos promovido para `app/server/src/types/`.
- [ ] **F4** — `types.ts` criado apenas quando necessario, nao preventivamente.

---

## Veredito

- **Fechado** — sem violacao.
- **Quase fechado** — desvio intencional documentado no codigo com motivo e rastreio.
- **Nao conforme** — violacao clara do contrato; bloqueia merge.
