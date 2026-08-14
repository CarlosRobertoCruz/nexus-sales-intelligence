# Verdade Absoluta - Garden

Cobre `src/garden/` como design system e toolkit portavel.

---

## Regra Central

Garden e domain-blind.

Nao conhece produto, feature, app, API interna ou core do projeto consumidor.

O codigo real do Garden sempre fica dentro do `src` do app consumidor.
Neste projeto: `client/src/garden/`.

Nao manter copia em `garden/` na raiz do repositorio.
Nao usar junction/symlink como padrao.

## Garden pode

- Exportar tokens.
- Exportar foundations.
- Exportar patterns.
- Exportar charts.
- Exportar utils/hooks/runtime/providers/types/ui genericos.
- Compor apenas coisas de dentro do proprio Garden.
- Usar libs externas genericas.

## Garden nao pode

- Importar `apps/`.
- Importar `core/`.
- Importar `@/api/*`.
- Importar domain/services/state/controller de feature.
- Ter nomes de produto em atributo, prop, tipo, comentario ou asset obrigatorio.
- Embutir logo/marca/texto de produto em foundation.

## Onde documentar

- Tokens, foundations, patterns e charts: [`../foundations.md`](../foundations.md).
- Utils, hooks, runtime, providers, types e Garden UI: [`../primitives.md`](../primitives.md).
