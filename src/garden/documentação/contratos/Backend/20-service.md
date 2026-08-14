# Service Contract

> Versao 1.0 — Junho 2026
> Cobre `app/server/src/modules/<modulo>/<modulo>.service.ts`.

---

## Responsabilidade

Service e o nucleo do modulo. Ele sabe das regras, faz as queries e retorna dados — mas nao sabe que existe HTTP.

- Conter regras de negocio do modulo.
- Executar queries no banco via `pool`.
- Retornar dados tipados e normalizados.
- Ser chamavel por controller, seed, script ou teste sem depender de HTTP.

---

## Pode usar

- `pool` do banco de dados.
- Outros services quando necessario.
- Types do proprio modulo ou de modulos relacionados.

---

## Nao pode usar

- `Request`, `Response`, `NextFunction` do Express.
- `logAuditEvent` — auditoria e responsabilidade do controller.
- Status codes HTTP, headers ou cookies.

---

## Padrao obrigatorio — retorno tipado

```ts
// correto — interface exportada, retorno previsivel
export interface LeadCard {
  id: string;
  name: string;
  conversationId: string;
  alreadyExisted: boolean;
}

export async function createLead(input: CreateLeadInput): Promise<LeadCard> {
  // ...
}
```

```ts
// errado — retorno implicito, sem tipo
export async function createLead(input: any) {
  const { rows } = await pool.query("...");
  return rows[0]; // o que e rows[0]?
}
```

---

## Padrao obrigatorio — idempotencia

Operacoes de criacao devem ser seguras para rodar mais de uma vez:

```ts
// correto — verifica antes de inserir
const { rows: existing } = await pool.query(
  `SELECT id FROM crm_cards WHERE conversation_id = $1`,
  [input.conversationId]
);
if (existing[0]) return { ...existing[0], alreadyExisted: true };
```

```ts
// errado — insere sem verificar, duplica dado
await pool.query(`INSERT INTO crm_cards (...) VALUES (...)`, [...]);
```

---

## Regras

| Regra | Motivo |
|---|---|
| Sem `Request`/`Response` | Service deve funcionar fora do contexto HTTP |
| Sem `logAuditEvent` | Auditoria pertence ao controller; service nao sabe quem chamou |
| Retorno tipado, sem `any` | Contrato de dados previsivel para quem consome |
| Idempotencia em operacoes de criacao | Seeds e retries nao devem duplicar dados |
| Nao expor `pool` para fora | Apenas funcoes com retorno definido sao API publica do service |

---

## Anti-patterns reais

### Service importando Express

```ts
// errado
import type { Request } from "express";

export async function createLead(req: Request) {
  const name = req.body.name;
}
```

```ts
// correto — interface propria
export async function createLead(input: CreateLeadInput) {
  const { name } = input;
}
```

### Service chamando logAuditEvent

```ts
// errado — service nao sabe quem chamou nem qual ip
export async function deleteAgent(id: string) {
  await pool.query("DELETE FROM agents WHERE id = $1", [id]);
  logAuditEvent({ tipo: "usuario", ... }); // de onde vem o ip? o responsavel?
}
```

```ts
// correto — controller registra apos chamar o service
export async function deleteAgent(id: string): Promise<void> {
  await pool.query("DELETE FROM agents WHERE id = $1", [id]);
}
// controller chama deleteAgent e depois logAuditEvent com req.ip
```

---

## Excecoes documentadas

```ts
// EXCECAO: retorna `any` aqui porque a estrutura do ERP externo
// e variavel e nao temos schema fixo ainda.
// Tipar quando a API do ERP estabilizar.
```
