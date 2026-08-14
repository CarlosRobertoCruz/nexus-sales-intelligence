# Backend Architecture Contract

> Versao 1.0 — Junho 2026
> Contrato arquitetural oficial do servidor. Se qualquer sugestao conflitar com este contrato, o contrato vence.

---

## Versao Curta

- Controller recebe HTTP, valida, delega e responde.
- Service contem regra de negocio e acessa o banco.
- Routes registra rotas e aplica middleware.
- Types descrevem contratos de dados, sem logica.
- Migrations alteram o banco de forma incremental e permanente.

---

## Por que essa estrutura existe

Separar controller de service evita que logica de negocio fique presa ao ciclo HTTP. Um service puro pode ser chamado por um seed, um script de migracao de dados ou um teste unitario sem precisar simular uma requisicao. Isso ja salvou horas de debug em producao.

---

## Fluxo Oficial

```
HTTP Request
  -> Routes         (autentica, roteia)
  -> Controller     (valida input, chama service, registra auditoria)
  -> Service        (regra de negocio, query no banco)
  -> Controller     (monta resposta)
HTTP Response
```

### Invariantes do fluxo

| Camada | Nunca faz |
|---|---|
| Controller | Query direta no banco |
| Service | Conhece `Request`, `Response` ou status codes HTTP |
| Routes | Contem logica de validacao ou negocio |
| Qualquer | Chama outro controller |

---

## Estrutura de Modulo

Estrutura padrao. Todo modulo com comportamento real nasce assim:

```txt
app/server/src/modules/<modulo>/
  <modulo>.controller.ts   <- HTTP: valida, delega, responde
  <modulo>.service.ts      <- regra de negocio e banco
  <modulo>.routes.ts       <- mapeamento de rotas
```

Opcional — criar so quando o codigo real pedir:

```txt
  <modulo>.types.ts        <- interfaces e tipos do modulo
```

Modulos grandes usam sufixo descritivo:

```txt
crm.controller.ts
crm.vendas.controller.ts
crm.relatorios.service.ts
```

### Nunca criar

| Pasta/arquivo | Por que nao |
|---|---|
| `helpers/`, `utils/` dentro de modulo | Logica util vai no service; nomes genericos escondem responsabilidade |
| Pasta vazia preventiva | So existe o que o codigo pede hoje |
| Logica dentro de routes | Routes e mapeamento, nao comportamento |

---

## Mapa de Imports

```
Routes        ->  controller, middleware
Controller    ->  service (mesmo modulo), auditoria.service
Service       ->  pool, outros services
Types         ->  sem imports de produto
```

### Proibido — e por que

| Import | Onde | Motivo |
|---|---|---|
| `pool` | Controller | Controller nao deve conhecer o banco |
| `Request`, `Response` | Service | Service deve ser chamavel sem HTTP |
| Logica de negocio | Routes | Routes e so mapeamento |
| Outro controller | Qualquer lugar | Controllers nao se orquestram entre si |

---

## Desvios Documentados

Todo desvio intencional deste contrato deve ter um comentario no codigo explicando:

```ts
// DESVIO: chama pool direto aqui porque esse endpoint e usado apenas
// em scripts de manutencao e nao tem service correspondente ainda.
// Rastrear em: issue #42
```

---

## Regra Suprema

Se qualquer sugestao conflitar com este contrato: seguir o contrato.
