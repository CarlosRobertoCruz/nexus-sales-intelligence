# Controller Contract

> Versao 1.0 — Junho 2026
> Cobre `app/server/src/modules/<modulo>/<modulo>.controller.ts`.

---

## Responsabilidade

Controller e a porta de entrada HTTP do modulo. Ele nao decide negocio — ele recebe, valida, delega e responde.

- Receber e ler `req.body`, `req.params`, `req.query`, `req.headers`.
- Validar se o input minimo esta presente.
- Chamar o service correspondente.
- Registrar evento de auditoria apos acao bem-sucedida.
- Devolver resposta HTTP com status correto.

---

## Pode usar

- Service do mesmo modulo.
- `logAuditEvent` e `resolveResponsavel` de `auditoria.service`.
- `req`, `res`, `next` do Express.
- Helper `tenant` declarado localmente no topo do arquivo.

---

## Nao pode usar

- `pool` diretamente — toda query fica no service.
- Outro controller.
- Logica de negocio, calculo ou transformacao de dados.

---

## Padrao obrigatorio — helper tenant

Todo controller que usa tenant declara o helper no topo:

```ts
// correto
const tenant = (req: Request) => (req.headers["x-tenant-id"] as string) ?? "default";
```

```ts
// errado — nunca hardcode tenant
const TENANT = "default";
```

**Por que:** o sistema e multi-tenant. Hardcodar "default" funciona enquanto existe um cliente, mas quebra silenciosamente quando o segundo entrar.

---

## Padrao obrigatorio — auditoria

```ts
// correto
logAuditEvent({
  tipo: "usuario",
  acao: "Lead criado no CRM",
  origem: "CRM",
  responsavel: resolveResponsavel(req.headers),
  detalhes: `Lead **"${body.contactName}"** criado no funil de vendas`,
  status: "sucesso",
  ip: req.ip ?? "",
  canal: body.channel ?? "Dashboard",  // canal dinamico
  acoes: ["Lead adicionado ao funil de vendas"],
}, tenant(req)).catch((err) => console.error("[audit]", err));
```

```ts
// errado — tres violacoes
logAuditEvent({
  tipo: "sistema",           // humano criou, nao o sistema
  responsavel: "Sistema",   // nunca string literal
  canal: "WhatsApp",        // nunca hardcoded
}, "default");              // nunca tenant literal
```

---

## Regras

| Regra | Motivo |
|---|---|
| Tenant via `tenant(req)` | Multi-tenant — ver padrao acima |
| `canal` dinamico | Canal real vem da conversa, nao do codigo |
| `tipo: "usuario"` para acao humana | Distingue humano de bot/automacao nos relatorios |
| `responsavel` via `resolveResponsavel` | Nome do agente vem do token de sessao |
| `.catch` na auditoria | Falha de log nao deve derrubar a operacao principal |
| Validacao no controller | Service assume que o input ja chegou valido |

---

## Anti-patterns reais

### Controller fazendo query direta

```ts
// errado
const { rows } = await pool.query("SELECT * FROM agents WHERE id = $1", [id]);
```

```ts
// correto
const agent = await agentsService.findById(id);
```

### Controller inventando regra de negocio

```ts
// errado — regra de negocio no controller
if (ticket.status === "open" && ticket.assignee === null && queue.autoAssign) {
  ticket.assignee = getNextAvailableAgent(queue);
}
```

```ts
// correto — delega pro service
const ticket = await ticketsService.assign(ticketId, { auto: true });
```

---

## Excecoes documentadas

Se precisar desviar, documente no codigo com motivo e rastreio:

```ts
// EXCECAO: leitura direta de pool aqui porque esse endpoint e interno
// e nao justifica criar um service so para isso.
// Revisar quando o modulo crescer.
```
