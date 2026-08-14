# State Contract

Cobre `feature/state/`.

---

## Regra principal

`state/` e opcional e raro.

Nao criar store por padrao. Criar apenas quando houver estado compartilhado/persistente dentro da feature que nao cabe bem em controller local.

## Quando criar

- Estado usado por mais de uma tela/componente distante.
- Estado precisa sobreviver a navegacao interna.
- Estado precisa ser observado por runtime/controller.
- Ha mutacoes coordenadas demais para `useState` local.

## Quando nao criar

- Filtro local.
- Modal aberto/fechado.
- Loading local.
- Form local.
- Dado derivado de props.
- View model.

## Regras

- State armazena e notifica.
- State nao decide regra de negocio.
- State nao monta view model.
- Mutacao apenas por setters/metodos do store.
- Antes de auditar state, perguntar: essa pasta realmente precisava existir?
