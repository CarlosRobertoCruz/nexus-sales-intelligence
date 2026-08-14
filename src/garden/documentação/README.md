# Ecossistema Garden

Toolkit portavel para novos projetos. Tudo aqui e domain-blind: nao sabe nada do produto que consome.

| Doc | O que cobre |
|---|---|
| [`foundations.md`](./foundations.md) | Tokens, foundations, patterns, charts |
| [`primitives.md`](./primitives.md) | Utils, hooks, runtime, providers, types e UI generica |
| [`contratos/README.md`](./contratos/README.md) | Roteiro de auditoria e contratos por camada |

---

## Estrutura

```txt
client/src/garden/
  tokens/        sistema de design tokens
  foundations/   componentes UI primitivos
  patterns/      composicoes domain-blind prontas
  charts/        componentes de visualizacao de dados
  utils/         funcoes puras
  hooks/         hooks React genericos
  runtime/       motores operacionais
  providers/     providers e contexts genericos
  types/         tipos genericos do Garden
  ui/            componentes React compartilhados domain-blind
  documentação/  contratos, catalogos e guias de auditoria
```

---

## Instalacao em um projeto

O Garden deve viver dentro do `src` do app consumidor.

Nao usar pasta `garden/` na raiz do repositorio para codigo real.
Nao usar junction/symlink como padrao. Um caminho oficial evita erro de TypeScript, alias, build e auditoria.

Estrutura esperada:

```txt
projeto/
  src/
    garden/
    apps/
    core/
```

Neste projeto, o caminho oficial e `client/src/garden/`.

Configurar alias no TypeScript:

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

Configurar alias no Vite:

```ts
resolve: {
  alias: { "@": path.resolve(__dirname, "src") }
}
```

Consumir tokens via barrel publico:

```ts
import { TOKENS } from "@/garden/tokens"
```

Nao existe hoje uma bridge obrigatoria de CSS variables. Se uma necessidade real aparecer para CSS global, `@keyframes`, pseudo-selectors ou theming via `var()`, criar a bridge dentro de `garden/tokens/` e documentar o boot nesse README.

---

## O que NAO esta incluido

O Garden e so a base reutilizavel. Cada projeto ainda precisa criar:

- `core/state/` - stores de autenticacao, sessao, dados de produto
- `core/services/` - integracao com a API do produto
- `core/types/` - tipos canonicos do dominio
- `core/ui/` - UI compartilhada entre features que conhece produto (nao e domain-blind, por isso nao mora no Garden)
- `core/domain/` - regra/calculo compartilhado entre features que conhece produto
- `apps/` - todas as features do produto

Neste projeto, `core/` nasceu em 2026-07-19 com `core/ui/brand/` (identidade visual de marca/fabricante) e `core/domain/metricas/` (calculo de saude/qualidade de sinal) — os dois primeiros modulos compartilhados entre features que sabem nome de produto e por isso nao podiam ir pro Garden. No mesmo dia, `core/types/` passou a existir fisicamente (`healthScore`, `signalQuality`, `channelPollution`, `wifiBand` — promovidos de `apps/onu/types/` por serem tipos canonicos de severidade/tom/qualidade reutilizados por metricas e por 5+ features). `core/state/` e `core/services/` ainda nao existem fisicamente.

---

## Regras de dependencia

- O projeto pode importar Garden.
- Garden nao pode importar `apps/`.
- Garden nao pode importar `core/`.
- Garden nao pode importar tipos, services, state ou regras de dominio do produto.
- Garden deve expor APIs genericas e semanticas, sem nomes de negocio.

---

## Onde cada coisa deve ficar

- Visual generico e reutilizavel: `src/garden/` (neste projeto: `client/src/garden/`)
- Regra de negocio: feature em `apps/`
- Integracao com API: `core/services/` ou `services/` da feature
- Estado de produto: `core/state/` ou `state/` da feature
- Tipos canonicos do dominio: `core/types/` ou `types/` da feature
- UI ou regra que conhece produto mas e reusada por 2+ features/apps: `core/ui/` ou `core/domain/` (nao domain-blind o suficiente pro Garden, especifica demais pra ficar presa numa feature so)

---

## Regras de promocao

Um padrao so sobe para o Garden quando:

- aparece em 3 projetos distintos ou 3 features distintas dentro de um projeto;
- e genuinamente domain-blind;
- tem API estavel;
- nao depende de regra de negocio, API, estado ou tipo do produto.

Se houver duvida, fica na feature do projeto atual primeiro.
