# ViewModel Contract

Cobre `feature/viewModel/`.

---

## Responsabilidade

- Montar objeto pronto pra UI combinando `domain/` (regra, classificacao, decisao) com `copy/` (texto) e `types/`.
- Existe so quando esse mapeamento comeca a pesar no `controller/` ou na `ui/` — nao e pasta padrao de toda feature.
- Nao e `adapters/`. `adapters/` foi removido do padrao por ser generico e sem direcao (traduz o que, pra onde?). `viewModel/` tem direcao fixa: dado ja resolvido pelo domain -> forma de apresentacao. A outra metade do que seria adapters (DTO externo -> dado do fluxo) vive em `services/`.

## Pode importar

- `domain/` (propria feature)
- `@/core/domain` — funcoes puras / classifiers compartilhados; proibido importar state, service ou efeito colateral de core/domain.
- `copy/` quando existir
- `types/` da propria feature e `core/types/`
- `@/garden/utils`
- `@/garden/types`
- `@/apps/onu/types/` (tipos canonicos do dominio ONU; equivale a core/types para viewModels desta camada)

## Nao pode importar

- `services/`
- `state/`
- `runtime/`
- `ui/`
- `@/garden/foundations`
- `@/garden/tokens`
- `core/ui`
- `@/api/*`

Excecao pontual: `@/core/ui/brand/viewModel/resolveBrandLogo`, `.../resolveManufacturerLogo` e `.../resolveChipsetLogo` — ver `10-ui.md`, secao "Excecao: modulo compartilhado core/ui/brand". Nao vale como precedente geral pra importar `core/ui` de viewModel.

## Quem pode importar viewModel/

- Só `controller/`. UI nunca importa `viewModel/` direto — recebe o resultado ja pronto via controller.

## Regras

- Funcao pura: mesma entrada, mesma saida; sem I/O, sem state, sem chamar service/runtime.
- Nao decide regra de negocio — regra vem de `domain/`; viewModel so formata/combina pro formato de apresentacao.
- Nome de arquivo declara o que constroi: `build<Coisa>View.ts`, `build<Coisa>Configs.ts`.
- Builder que nao usa `domain/` nem `copy/` — so reformata shape sem decisao nem texto — normalmente pertence a `controller/`; so extrair pra `viewModel/` quando o mapeamento realmente cresce.
