# Types Contract

Cobre `feature/types/`, `core/types/` e `garden/types/`.

---

## Escopo

| Pasta | Uso |
|---|---|
| `feature/types/` | Contratos internos de uma feature |
| `core/types/` | Contratos canonicos do produto |
| `garden/types/` | Tipo generico, domain-blind, usado internamente pelo Garden |

## Regras

- Tipo nao carrega logica.
- DTO bruto de API nao atravessa a feature inteira.
- `any` e proibido em domain, controller e services.
- `unknown` so na fronteira externa e deve ser resolvido antes de seguir fluxo.
- Tipo repetido em 3 ou mais pontos deve subir para o escopo correto.
- **Exceção aprovada (23/07)**: `core/types/metricas/*` pode importar `@shared/*.json` (dado
  estático fora de `src/`, mesma fonte lida pelo backend) quando o valor default de um limite é
  compartilhado entre client e server — detalhe em `85-core.md` §`core/types/`.
