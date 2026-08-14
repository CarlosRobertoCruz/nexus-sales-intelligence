# Contratos de Auditoria

Use esta pasta como roteiro para auditar features, Garden e arquitetura sem se perder.

---

## Caminho oficial do Garden

O Garden de codigo sempre vive dentro do `src` do app consumidor.

Neste projeto, auditar e editar apenas:

```txt
client/src/garden/
```

Nao usar `garden/` na raiz do repositorio para codigo real.
Nao usar junction/symlink como padrao.

---

## Estrutura padrao de feature

Toda feature nova com comportamento real deve nascer com estas pastas:

```txt
feature/
  ui/
  controller/
  domain/
  services/
  types/
```

### Sempre existem

| Pasta | Papel |
|---|---|
| `ui/` | Renderiza e reage; nao decide regra |
| `controller/` | Orquestra fluxo, estado de tela e handlers |
| `domain/` | Decide regra, validacao e significado |
| `services/` | Integra API/sistemas externos |
| `types/` | Contratos de dados da feature |

### Opcionais

Crie apenas quando o codigo real pedir:

| Pasta | Quando criar |
|---|---|
| `viewModel/` | Quando o mapeamento para UI comecar a pesar no controller/UI |
| `runtime/` | Polling, websocket, upload, timers, observers ou ciclo continuo |
| `state/` | Estado compartilhado/persistente dentro da feature |
| `copy/` | Quando a feature tem texto proprio (label, erro, aria-label) para tirar de `ui/`/`controller/` |

### Nunca criar por padrao

- `actions/`
- `selectors/`
- `adapters/`
- `shared/`
- `helpers/`
- `misc/`
- pasta vazia preventiva

---

## Ordem para auditar uma feature

1. **Tipos** - [`70-types.md`](./70-types.md)
   Entenda os contratos de dados antes de olhar fluxo.

2. **Domain** - [`30-domain.md`](./30-domain.md)
   Confirme onde ficam regras, validacoes e decisoes.

3. **Services** - [`40-services.md`](./40-services.md)
   Verifique API, DTOs, erros e dados reais.

3b. **API** - [`45-api.md`](./45-api.md)
   Fronteira HTTP crua (`src/api/*`) que o service consome — so audite se o service tocou nela.

4. **Controller** - [`20-controller.md`](./20-controller.md)
   Veja se so orquestra e nao inventa regra.

5. **ViewModel** - [`16-viewModel.md`](./16-viewModel.md)
   Se existir, confira se so prepara apresentacao combinando domain + copy.

6. **UI** - [`10-ui.md`](./10-ui.md)
   Verifique render, acessibilidade, tokens e imports.

6b. **Copy** - [`15-copy.md`](./15-copy.md)
   So audite se a pasta existir; confira se texto saiu de `ui/`/`controller/`.

7. **Runtime** - [`50-runtime.md`](./50-runtime.md)
   So audite se a pasta existir.

8. **State** - [`60-state.md`](./60-state.md)
   So audite se a pasta existir; primeiro questione se deveria existir.

9. **Checklist final** - [`02-checklist.md`](./02-checklist.md)
   Feche conformidade e pendencias.

---

## Ordem para auditar o Garden

1. [`80-garden.md`](./80-garden.md)
2. [`../foundations.md`](../foundations.md)
3. [`../primitives.md`](../primitives.md)
4. [`02-checklist.md`](./02-checklist.md), bloco **I. Garden**.

---

## Ordem para auditar o Core (`src/core/*`)

1. [`85-core.md`](./85-core.md)
   `core/types/` (regra já em `70-types.md`), `core/domain/` e `core/ui/` — critério de promoção
   em `01-review-guide.md` §Promoção ("compartilhado mas conhece linguagem de produto").
2. [`02-checklist.md`](./02-checklist.md), bloco **N. Core**.

---

## Contratos por camada

| Pasta/area | Contrato |
|---|---|
| `feature/ui/` | [`10-ui.md`](./10-ui.md) |
| `feature/copy/` | [`15-copy.md`](./15-copy.md) |
| `feature/viewModel/` | [`16-viewModel.md`](./16-viewModel.md) |
| `feature/controller/` | [`20-controller.md`](./20-controller.md) |
| `feature/domain/` | [`30-domain.md`](./30-domain.md) |
| `feature/services/` ou `core/services/` | [`40-services.md`](./40-services.md) |
| `src/api/onu/`, `src/api/layout/` | [`45-api.md`](./45-api.md) |
| `feature/runtime/` | [`50-runtime.md`](./50-runtime.md) |
| `feature/state/` | [`60-state.md`](./60-state.md) |
| `feature/types/`, `core/types/`, `garden/types/` | [`70-types.md`](./70-types.md) |
| `src/garden/` | [`80-garden.md`](./80-garden.md) |
| `src/core/domain/`, `src/core/ui/` | [`85-core.md`](./85-core.md) |
