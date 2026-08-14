# Copy Contract

Cobre `feature/copy/`.

---

## Responsabilidade

- Centralizar todo texto de produto de uma feature: label, placeholder, mensagem de erro, mensagem vazia, aria-label, texto de estado.
- Oferecer formatador puro de string quando o texto precisa de interpolacao ou pluralizacao.
- Tirar string literal de `ui/` e `controller/`.

## Estrutura

- Arquivo: `feature/copy/<nomeDaFeature>Copy.ts`.
- Export unico: `<NOME_DA_FEATURE>_COPY`, objeto `as const`.
- Chaves aninhadas por secao, espelhando a estrutura visual da feature (ex.: `hero`, `wifi`, `network`, `actions`).
- Mapa de enum vira `satisfies Record<Enum, string>`.

## Pode importar

- `../types/` da propria feature, so para tipar mapa de enum com `satisfies Record<Enum, string>`.

## Nao pode importar

- `domain/`
- `services/`
- `controller/`
- `ui/`
- `state/`
- `runtime/`
- `@/garden/*`
- `@/api/*`

## Quem pode importar copy/

- `ui/`: usa direto quando o texto e estatico.
- `controller/` e `viewModel/`: usa quando precisa escolher ou formatar a copy antes de entregar para a UI (ex.: selecionar texto certo por enum, montar mensagem com dado ja resolvido).

## Regras

- Todo valor e string ou funcao pura que retorna string.
- Funcao de copy so formata (interpolacao, plural, template); nunca decide regra de negocio nem le state/API.
- **Nao** coloca utilitario generico de numero/data/string no `copy/` (ex.: compactar `1200` → `1.2k`, `toFixed`, locale). Isso vai em `garden/utils/`. Copy so monta o texto ja com pedacos formatados (`(tx, rx) => \`${tx} / ${rx}\``) ou faz interpolacao trivial de produto (`${dbm} dBm`).
- Nao guarda JSX, handler, cor, icone ou token.
- Sem `any`; parametro de funcao de copy tem tipo explicito.
- String repetida em 2+ features nao se duplica por padrao; promover para escopo compartilhado quando esse escopo existir.
- Feature sem texto proprio (usa so texto de outra feature ou do Garden) nao cria `copy/`.
