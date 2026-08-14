# Services Contract

Cobre `feature/services/` e `core/services/`.

---

## Responsabilidade

- Integrar API e sistemas externos.
- Resolver DTO externo antes de devolver ao fluxo.
- Normalizar erros e retornos.

## Pode importar

- `@/api/*`.
- `garden/utils`.
- `feature/types`.
- `core/types`.
- `@/apps/onu/services/` (services compartilhados do dominio ONU, ex. `onuSummaryMapper` — traducao DTO->dominio reaproveitada por mais de uma feature ONU; equivale a `core/services`, que nao existe como pasta propria hoje, mesmo tratamento ja dado a `@/apps/onu/types/`).

## Nao pode importar

- UI.
- Foundations.
- State.
- Controller.

## Regras

- Service e a unica fronteira com `@/api/*`.
- Retorno deve ser previsivel.
- Nao decidir regra de negocio que pertence ao domain.
