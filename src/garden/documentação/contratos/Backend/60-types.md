# Types Contract

> Versao 1.0 — Junho 2026
> Cobre `<modulo>.types.ts` e interfaces exportadas pelos services.

---

## Responsabilidade

Types descrevem a forma dos dados que trafegam entre camadas. Eles nao tem logica — so estrutura.

---

## Onde vivem

Por padrao, interfaces de input e output do service ficam no proprio arquivo do service:

```ts
// agents.service.ts
export interface CreateAgentInput { ... }
export interface Agent { ... }
```

Criar `<modulo>.types.ts` apenas quando as interfaces crescerem o suficiente para poluir o service.

---

## Pode usar

- Tipos nativos do TypeScript.
- Tipos de outros modulos quando necessario.

---

## Nao pode usar

- Logica, funcoes ou classes com comportamento.
- `Request`, `Response`, `NextFunction` do Express — esses ficam no controller.

---

## Padrao obrigatorio — sem any

```ts
// correto — tipo preciso
export interface CreateLeadInput {
  conversationId: string;
  contactName: string;
  channel?: string;
  channelKind?: string;
}
```

```ts
// errado — perde toda seguranca de tipo
export async function createLead(input: any) { ... }
```

Quando a estrutura for realmente desconhecida, usar `unknown` com narrowing:

```ts
function parseWebhookPayload(raw: unknown): WebhookPayload {
  if (!isWebhookPayload(raw)) throw new Error("payload invalido");
  return raw;
}
```

---

## Escopo dos tipos

| Onde vive | Quando usar |
|---|---|
| No proprio service | Interface usada por um unico modulo |
| `<modulo>.types.ts` | Interfaces do modulo usadas por controller + service + routes |
| `app/server/src/types/` | Tipo compartilhado por 2+ modulos sem dono claro |

---

## Regras

| Regra | Motivo |
|---|---|
| Sem `any` | Perde rastreabilidade de erro em runtime |
| Sem logica nos types | Types nao executam; se tem logica, pertence ao service |
| Tipo repetido promovido | Duplicar tipo cria divergencia silenciosa entre modulos |
| `types.ts` criado so quando necessario | Arquivo preventivo vazio e ruido |
