# Checklist de Conformidade

Documento operacional para PR e auditoria por camada. Marque apenas os blocos tocados pela mudanca; o resto fica N/A.

---

## A. Controller

- [ ] **A1** - Nao importa foundations, patterns, TOKENS ou core/ui.
- [ ] **A2** - Nao decide regra de negocio.
- [ ] **A3** - Orquestra domain, services, runtime, state e viewModel sem mudar significado.
- [ ] **A4** - Se exportar container JSX, importa UI apenas para wiring/composicao, sem estilo.
- [ ] **A5** - Fluxos async tem estado explicito e erro visivel para o fluxo.

## B. UI

- [ ] **B1** - Nao importa domain, state, services, runtime ou dev.
- [ ] **B2** - Usa Garden/core UI/tokens conforme contrato; sem hardcode visual desnecessario.
- [ ] **B3** - Recebe view model, handlers e flags ja preparados.
- [ ] **B4** - Interacao preserva acessibilidade das foundations.

## C. Domain

- [ ] **C1** - Puro: sem React, browser, API, state, service ou efeito colateral.
- [ ] **C2** - Concentra regra, validacao, decisao e transicao.
- [ ] **C3** - Tempo real so por injecao explicita.

## D. Services

- [ ] **D1** - E a unica camada que importa `@/api/*`.
- [ ] **D2** - Resolve DTO externo antes de devolver ao fluxo.
- [ ] **D3** - Retorno previsivel com data/error/meta/status quando aplicavel.
- [ ] **D4** - Nao conhece UI, foundations ou regra de render.

## E. Runtime

- [ ] **E1** - Existe apenas para ciclo operacional real.
- [ ] **E2** - Nao decide negocio nem render.
- [ ] **E3** - Usa services/config injetada para fronteiras externas.

## F. State

- [ ] **F1** - So existe quando ha estado compartilhado/persistente real.
- [ ] **F2** - Armazena e notifica; nao decide regra.
- [ ] **F3** - Mutacao apenas por setters/metodos do store.
- [ ] **F4** - Nao monta view model.

## G. ViewModel

- [ ] **G1** - Prepara dados para UI sem acessar state diretamente.
- [ ] **G2** - Nao chama service/runtime.
- [ ] **G3** - Nao inventa regra de negocio.

## H. Types

- [ ] **H1** - Tipos nao carregam logica.
- [ ] **H2** - `any` ausente em domain/controller/services.
- [ ] **H3** - Tipos repetidos promovidos ao escopo certo: feature, core ou garden.

## I. Garden

- [ ] **I1** - Nao importa apps, core, api ou produto.
- [ ] **I2** - Foundation/pattern/ui sao domain-blind.
- [ ] **I3** - Visual usa tokens; sem marca/produto embutidos.
- [ ] **I4** - Novo item documentado em `foundations.md` ou `primitives.md`.

## J. Copy

- [ ] **J1** - So importa `feature/types` para tipar mapa de enum.
- [ ] **J2** - Todo valor e string ou funcao pura que retorna string; sem JSX, handler, cor, icone ou token.
- [ ] **J3** - Nao decide regra de negocio nem le state/API.
- [ ] **J4** - `ui/`/`controller/` da feature nao tem string literal que devia estar em `copy/`.

## K. Dados de Dev e Mock

- [ ] **K1** - Nenhum mock de API dentro de feature.
- [ ] **K2** - Dados de dev ficam isolados e nao sao importados pela feature.

## L. Acessibilidade e Observabilidade

- [ ] **L1** - Teclado, foco, disabled e aria preservados quando aplicavel.
- [ ] **L2** - Fluxos criticos conseguem emitir erro/warning/evento fora da UI.

## M. API (`src/api/*`)

- [ ] **M1** - So `fetch` + shape de DTO, sem regra de negocio nem formatacao de apresentacao.
- [ ] **M2** - So importa `./apiShared` (nada de garden/utils, feature/types, core/types, React).
- [ ] **M3** - Escrita (POST) usa `postActionApi` de `apiShared.ts`, nao reimplementa na mao.
- [ ] **M4** - Leitura (GET) le `payload?.error?.safe_message` antes do fallback generico.
- [ ] **M5** - Nome de funcao com sufixo `Api` (`fetchXxxApi`/`xxxApi`/`setXxxApi`).

## N. Core (`src/core/domain/`, `src/core/ui/`)

- [ ] **N1** - So promovido pra core quando repete em 2+ features (`core/domain`) ou 3+ (`core/ui`).
- [ ] **N2** - `core/domain` e domain puro: sem React/browser/state/service/runtime/`@/api/*`.
- [ ] **N3** - `core/domain` nao importa `feature/*` de nenhum app (so o contrario).
- [ ] **N4** - `core/ui` conhece linguagem de produto (por isso nao e Garden), mas so importa `garden/*` e assets proprios.
- [ ] **N5** - `core/ui` nao importa `feature/*`, `@/api/*`, services ou domain de feature.

---

## Veredito

- **Fechado**: sem violacao.
- **Quase fechado**: apenas trade-offs documentados.
- **Nao conforme**: existe violacao clara do contrato.
