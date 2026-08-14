# Architecture Contract

Contrato arquitetural oficial. Se qualquer sugestao conflitar com este contrato, o contrato vence.

---

## Versao Curta

- UI reage e renderiza.
- Controller conecta fluxo e monta view model.
- Domain decide e valida.
- Services integram API e sistemas externos.
- Runtime executa ciclos operacionais longos quando necessario.
- State e opcional; so existe quando ha estado compartilhado/persistente que justifica store.
- Types descrevem contratos de dados, sem logica.
- Garden fornece UI, tokens, utils, hooks e runtime genericos, sem produto.

---

## Fluxo Oficial

`UI -> Controller -> Domain -> Services -> Controller -> UI`

- UI nunca decide negocio.
- Controller nunca inventa regra de negocio.
- Domain nunca toca React, browser, API ou state.
- Services sao a fronteira com `@/api/*`.
- State, quando existir, nao reinterpreta dados.
- Runtime so entra quando ha polling, websocket, upload ou ciclo operacional real.
- View model existe quando a apresentacao precisa de builder/mapper proprio.

---

## Estrutura de Feature

Estrutura padrao. Essas pastas existem em toda feature com comportamento real:

```txt
feature/
  ui/
  controller/
  domain/
  services/
  types/
```

Pastas opcionais. Criar so quando o codigo real pedir:

```txt
feature/
  viewModel/     <- quando mapear dados para UI pesar no controller/UI
  runtime/       <- polling, websocket, upload, timers ou observers
  state/         <- estado compartilhado/persistente dentro da feature
  copy/          <- texto proprio da feature (label, erro, aria-label)
```

Pastas removidas:

- `actions/`: se houver `state/`, setters/metodos vivem no store.
- `selectors/`: derivacoes de apresentacao vivem no controller ou viewModel.
- `adapters/`: traducao de API vive em `services`; traducao visual vive em `viewModel`.
- `shared/`, `helpers/`, `misc/`: nomes genericos demais; use nome de fluxo/dominio real.
- pasta vazia preventiva: proibida.

### Ordem de auditoria de feature

1. `types/`
2. `domain/`
3. `services/`
4. `controller/`
5. `viewModel/` se existir
6. `ui/`
7. `runtime/` se existir
8. `state/` se existir

`state/` deve ser auditado com uma pergunta antes de qualquer outra: essa pasta realmente precisava existir?

---

## Estrutura do Garden

```txt
src/garden/
  tokens/
  foundations/
  patterns/
  charts/
  utils/
  hooks/
  runtime/
  providers/
  types/
  ui/
```

Neste projeto, o caminho oficial e `client/src/garden/`.
Nao manter copia em `garden/` na raiz e nao usar junction/symlink como padrao.

---

## Mapa de Imports

### Permitido

- UI -> controller, copy quando existir, garden/foundations, garden/patterns, garden/ui, garden/tokens, garden/charts, core/ui quando existir, `@/apps/onu/types/` (tipos canonicos do dominio ONU; necessario para tipar props de entrada do modulo raiz).
- Controller -> domain, services, runtime, viewModel, state quando existir, copy quando existir, garden/utils, `@/apps/onu/types/` (tipos canonicos do dominio ONU; equivale a core/types para controllers desta camada). Controller-raiz de composicao de tela (hoje `layout/shell` e `onu/shell` — mesmo papel de `10-ui.md` §Excecao, um nivel abaixo) pode importar e compor o controller de uma feature satelite que ele mesmo monta na UI (hoje `useShellNav`, `useOnuCapturas`), desde que so repasse o resultado pronto (estado/handlers), sem ler ou reinterpretar estado interno dela.
- Copy -> feature/types apenas para tipar mapa de enum.
- ViewModel -> domain, core/domain (funcoes puras / classifiers compartilhados; sem state, service ou efeito colateral), copy quando existir, feature/types, core/types, garden/utils, garden/types, `@/apps/onu/types/` (tipos canonicos do dominio ONU; equivale a core/types para viewModels desta camada).
- Domain -> feature/types, core/types, garden/utils, garden/types, core/domain (funcoes puras / classifiers compartilhados entre features; mesma regra do domain, sem state/service/runtime/efeito colateral — ver `30-domain.md`).
- Services -> garden/utils, feature/types, core/types, `@/api/*`, `@/apps/onu/services/` (services compartilhados do dominio ONU, ex. `onuSummaryMapper`; equivale a core/services — que nao existe como pasta propria — para services desta camada, mesmo tratamento ja dado a `@/apps/onu/types/`).
- Runtime de feature -> services, domain apenas para calculo puro, garden/runtime.
- State opcional -> feature/types, core/types.
- Garden interno -> somente `@/garden/*` e libs externas genericas.

### Proibido

- UI -> state, services, domain, runtime, dev.
- Qualquer camada fora de services -> `@/api/*`.
- Controller -> garden/foundations, TOKENS, core/ui.
- Domain -> React, UI, state, services, runtime, `@/api/*`.
- Services -> UI, foundations, state.
- Copy -> domain, services, controller, ui, state, runtime, garden, `@/api/*`.
- Garden -> apps, core, feature/domain, feature/services, `@/api/*`, tipos de produto.

---

## Regra Suprema

Se qualquer sugestao conflitar com este contrato: seguir o contrato.
