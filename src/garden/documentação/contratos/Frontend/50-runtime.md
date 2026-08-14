# Runtime Contract

Cobre `feature/runtime/` e orienta uso de `garden/runtime/`.

---

## Quando existe

Criar apenas para ciclo operacional real:

- polling;
- websocket;
- upload;
- timers;
- observers;
- processos longos.

## Regras

- Runtime nao decide negocio.
- Runtime nao renderiza.
- Runtime deve receber services/config por injecao quando tocar fronteira externa.
- `garden/runtime/` precisa ser domain-blind.
