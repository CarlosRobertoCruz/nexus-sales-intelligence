# Routes Contract

> Versao 1.0 — Junho 2026
> Cobre `app/server/src/modules/<modulo>/<modulo>.routes.ts`.

---

## Responsabilidade

Routes e so mapeamento. Ela nao valida, nao transforma, nao decide — apenas conecta metodo + path a um handler e aplica middleware.

---

## Pode usar

- Handlers do controller do mesmo modulo.
- Middleware de `app/server/src/middleware/`.
- `Router` do Express.

---

## Nao pode usar

- `pool`.
- Services.
- Logica de validacao, transformacao ou negocio.

---

## Padrao obrigatorio

```ts
// correto — so mapeamento
import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as controller from "./agents.controller";

const router = Router();

router.get("/",        authenticate, controller.listAgentsHandler);
router.post("/",       authenticate, controller.createAgentHandler);
router.patch("/:id",   authenticate, controller.updateAgentHandler);
router.delete("/:id",  authenticate, controller.deleteAgentHandler);

export default router;
```

```ts
// errado — logica dentro de routes
router.post("/agents", authenticate, async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: "name required" });
  const agent = await pool.query("INSERT INTO agents ...");
  res.json(agent);
});
```

---

## Regras

| Regra | Motivo |
|---|---|
| Nenhuma logica no arquivo | Routes e indice, nao comportamento |
| Middleware de auth em toda rota protegida | Omissao cria brecha de seguranca silenciosa |
| Omissao de auth documentada | Rotas publicas intencionais devem ser explicitas |
| Um arquivo de routes por modulo | Facilita encontrar e auditar endpoints |

---

## Documentando rota publica intencional

```ts
// rota publica — autenticacao nao se aplica (webhook externo com validacao propria)
router.post("/webhook/n8n", controller.n8nWebhookHandler);
```
