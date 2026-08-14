# Controller Contract

Cobre `feature/controller/` e view model leve.

---

## Responsabilidade

- Orquestrar fluxo entre UI, domain, services, runtime e state opcional.
- Preparar dados para a UI quando ainda for simples.
- Expor handlers e flags para a UI.
- Controlar estado local de tela quando nao justificar store.

## Pode importar

- `domain/`
- `services/`
- `runtime/`
- `viewModel/`
- `state/` quando existir
- `copy/` quando existir
- `types/`
- `@/garden/utils`
- `@/apps/onu/types/` (tipos canonicos do dominio ONU; equivale a core/types para controllers desta camada)

Excecao pontual — controller-raiz de composicao de tela: hoje `layout/shell` e `onu/shell` sao a raiz que decide o layout inteiro da tela e monta as features satelite na UI (mesmo papel reconhecido em `10-ui.md` §Excecao pra UI). O controller dessa raiz pode importar e chamar o controller de uma feature satelite que ele mesmo compoe (ex.: `useOnuShell` chamando `useOnuCapturas`; `useShell` chamando `useShellNav`), desde que so repasse o resultado pronto (estado/handlers) pra UI, sem ler ou reinterpretar estado interno da feature satelite. Nao vale como precedente pra qualquer controller importar controller de feature irma fora desse papel de raiz.

## Nao pode importar

- `@/garden/foundations`
- `@/garden/tokens`
- `core/ui`
- `@/api/*`

Excecao pontual: `@/core/ui/brand/viewModel/resolveBrandLogo`, `.../resolveManufacturerLogo` e `.../resolveChipsetLogo` — ver `10-ui.md`, secao "Excecao: modulo compartilhado core/ui/brand". Nao vale como precedente geral pra importar `core/ui` de controller.

## Regras

- Controller nao inventa regra de negocio.
- Se o mapeamento para UI crescer, extrair para `viewModel/`.
- Se estado for apenas local da tela, manter no controller.
- Se estado for compartilhado/persistente, considerar `state/`.
