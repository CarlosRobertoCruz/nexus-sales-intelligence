# Garden - Foundations e Tokens

Cobre `garden/tokens/`, `garden/foundations/`, `garden/patterns/` e `garden/charts/`.

---

## Regra Central

Tudo no Garden e **domain-blind**. Nenhum componente, token, pattern ou chart sabe nada sobre o dominio de negocio. Se precisar de logica de dominio, fica fora do Garden.

---

## Tokens

Variaveis de design consumidas pelos foundations. Importar sempre via `@/garden/tokens`.

| Token | O que define |
|---|---|
| **color** | Paleta completa: brand, content, surface, feedback, stroke, interactive, chart e category |
| **spacing** | Escala numerica de espacamento (ex: `TOKENS.spacing[12]`) |
| **typography** | Familias, tamanhos, pesos e line-heights |
| **radius** | Valores de border-radius |
| **shadow** | Sombras por nivel |
| **size** | Tamanhos fixos de elementos (icones, avatares, min-width/height de componentes) |
| **effects** | Blur, opacidade, filtros (`filter.iconGlowInverse`) e efeitos visuais |
| **color.brand.railItemActive** | Gradiente radial do item ativo no rail/sidebar |
| **color.brand.fillSubtle** | Fundo brand translúcido para hover/seleção suave |
| **color.content.neutral** | Cinza neutro fixo (chrome de ação / tom gray) |
| **motion** | Duracao, easing e animacoes |
| **zIndex** | Camadas de empilhamento (modal, tooltip, overlay etc.) |
| **reportExport** | Aparencia de relatorios Excel/PDF alinhada aos tokens |

### Uso obrigatorio

- Hardcode visual e proibido em qualquer camada.
- Feature UI pode compor layout com style inline, mas sempre usando token.
- Exemplos: `TOKENS.spacing[8]`, `TOKENS.size[24]`, `TOKENS.radius[10]`.

### Paletas por tema (`color` e `shadow`)

- `core/color.ts` e `core/shadow.ts` nao tem valor proprio — cada um so reexporta
  a paleta ativa de `core/palettes/` (`color.dark.ts`/`shadow.dark.ts` hoje).
- `core/palettes/color.light.ts` e `shadow.light.ts` ficam preservados, mesmo
  sem uso — o NDS e escuro por decisao de produto, nao por falta de tema claro.
- Trocar de tema e so trocar o import dentro de `color.ts`/`shadow.ts`; nenhum
  consumer (foundation, feature) muda, porque todos leem `TOKENS.color.*`/
  `TOKENS.shadow.*` pela mesma exportacao de sempre.
- Toda paleta nova (ou ajuste de uma existente) tem que manter exatamente as
  mesmas chaves nas duas variantes (light/dark) — senao trocar de tema quebra
  em runtime pra quem usa uma chave que so existe numa das duas.

### Bridge JS -> CSS

- Tokens sao JS-only por padrao; consumidos via `TOKENS.*` em estilo inline ou nas foundations.
- Nao existe hoje uma bridge obrigatoria de CSS variables.
- Quando CSS global exigir valor estatico (`@keyframes`, `::-webkit-scrollbar`, pseudo-selectors globais, theming via `var()`), criar uma bridge em `garden/tokens/` e documentar a chamada de boot no README do Garden.
- Hardcodar valores porque "JS nao chega ali" nao e justificativa: a saida correta e adicionar uma variavel na bridge quando ela existir.
- A bridge deve expor canais semanticos quando fizer sentido (ex: `--brand-rgb` como `r, g, b` sem alpha).

---

## Foundations

Primitivos de UI. Domain-blind e consomem apenas tokens, assets do Garden e outros primitives do proprio Garden quando necessario.

### Foundations podem

- Expor API semantica.
- Encapsular interacao.
- Encapsular acessibilidade.
- Encapsular visual.
- Compor outros foundations.

### Foundations nao podem

- Importar de `apps/`.
- Importar de `core/`.
- Importar de `domain/`.
- Importar de `state/`.
- Importar de `services/`.
- Importar tipos de dominio do produto.

### Tipos de foundation vs tipos de dominio

Quando uma foundation precisar de um shape proximo a um tipo de dominio, ela define o seu proprio shape no mesmo modulo, sem importar tipos do produto. O shape tem campos opcionais e nome agnostico de dominio (ex: `FilePreviewItem`, nao `FileItem`). O consumer faz a adaptacao.

### Interacao vs visual

- `Pressable` governa interacao. Todo elemento clicavel usa `Pressable`, nunca `<button>` ou `<div onClick>` direto.
- `Highlight` governa estado visual. Nunca logica de cor manual baseada em booleano de hover.
- `cursor`, `keyboard`, `focus` e `disabled` sao responsabilidade do `Pressable`.
- `background`, `border` e `boxShadow` de estado interativo sao responsabilidade do `Highlight`.

### Icones

- SVG como componente React.
- `currentColor`.
- Tamanho controlado pelo container.
- Exportar pelo barrel `foundations/assets/icons/icons.ts`.

### Regra de promocao para foundation

- Um padrao de UI ou interacao que aparece 3 vezes ou mais deve ser avaliado para virar foundation.
- A promocao nao e automatica: o padrao precisa ser generico, sem semantica de produto e reutilizavel em multiplas features.
- Se houver duvida, manter na feature ate o padrao se estabilizar.
- Proibido criar foundation antecipadamente sem repeticao real.

---

## Catalogo de Foundations

Inventario oficial. Qualquer nova foundation deve ser registrada aqui.

### Assets

| Asset | Arquivo | O que faz |
|---|---|---|
| **Icons barrel** | `assets/icons/icons.ts` | Exporta os icones SVG do Garden por categoria |

### Display

| Componente | Arquivo | O que faz |
|---|---|---|
| **Avatar** | `display/Avatar.tsx` | Container quadrado ou circular com iniciais do usuario ou icone |
| **EyebrowSectionTitle** | `display/EyebrowSectionTitle.tsx` | Texto em caixa-alta para rotulos de secao estilo eyebrow |
| **GridTable** | `display/GridTable.tsx` | Tabela baseada em CSS Grid com colunas, cabecalho estilizado e estado vazio |
| **Icon** | `display/Icon.tsx` | Container quadrado para SVGs com aliases de tamanho |
| **IconAction** | `display/IconAction.tsx` | Botao de icone com variantes visuais |
| **IconTile** | `display/IconTile.tsx` | Container quadrado com fundo pastel em varios tons e tamanhos |
| **Image** | `display/Image.tsx` | Wrapper de `<img>` com defaults sensatos e ref forwarding |
| **KpiCard** | `display/KpiCard.tsx` | Card de metrica com icone, sublabel e conteudo trailing |
| **SelectablePastelIconTile** | `display/SelectablePastelIconTile.tsx` | `IconTile` pastel clicavel com estado de selecao |
| **SignalBars** | `display/SignalBars.tsx` | Icone SVG de barras de sinal (1–5), cores via props |
| **DecorativeBars** | `display/DecorativeBars.tsx` | Faixa de barras decorativas (sem dados); cor/alturas via props |
| **TableContainer** | `display/TableContainer.tsx` | Wrapper de tabela com borda, border-radius e surface styling |
| **TablePagination** | `display/TablePagination.tsx` | Controles de paginacao com seletor de pagina e botoes de navegacao |
| **Text** | `display/Text.tsx` | Span tematico com aliases de tamanho, peso, tone e truncation |
| **TimelineRailNode** | `display/TimelineRailNode.tsx` | No circular SVG para trilhos de timeline vertical |
| **TimelineRailTrack** | `display/TimelineRailTrack.tsx` | Coluna de trilho vertical com linha centrada e slot para `TimelineRailNode` |

### Effects

| API | Arquivo | O que faz |
|---|---|---|
| **insetGlowShadow** | `effects/insetGlow.ts` | Receita de `box-shadow` inset (`strong` / `soft`) a partir de hex ou `r,g,b` |
| **insetGlowFill** | `effects/insetGlow.ts` | Fundo `rgba` casado com a cor do glow |
| **hexToRgbChannels / toRgbChannels** | `effects/insetGlow.ts` | Converte cor pra canais usados no glow |

### Feedback

| Componente | Arquivo | O que faz |
|---|---|---|
| **Badge** | `feedback/Badge.tsx` | Pill semantico com variantes e animacao pulse |
| **LoadingScreen** | `feedback/LoadingScreen.tsx` | Splash screen de boot generica com logo opcional e barra de progresso |
| **ProgressBar** | `feedback/ProgressBar.tsx` | Barra de progresso acessivel com track/fill e altura customizavel |
| **Skeleton** | `feedback/Skeleton.tsx` | Bloco placeholder para loading com animacao shimmer |
| **StatusDot** | `feedback/StatusDot.tsx` | Circulo pequeno de status, herda currentColor |
| **StatusPill** | `feedback/StatusPill.tsx` | Pill de status com borda, glow inset e StatusDot; `label` + `tone` |

### Interaction

| Componente | Arquivo | O que faz |
|---|---|---|
| **ActionIconButton** | `interaction/ActionIconButton.tsx` | Botao de icone para acoes comuns com tooltip e suporte a danger |
| **Button** | `interaction/Button.tsx` | Botao com variantes primary/soft/danger/icon |
| **Card** | `interaction/Card.tsx` | Card clicavel ou estatico com variantes visuais e render-prop de hover |
| **Checkbox** | `interaction/Checkbox.tsx` | Checkbox acessivel com label e estados animados |
| **DatePicker** | `interaction/DatePicker.tsx` | Seletor de data brandado em pt-BR; retorna/recebe `YYYY-MM-DD` |
| **Highlight** | `interaction/Highlight.tsx` | Wrapper de estado visual para hover/active/focused |
| **Input** | `interaction/Input.tsx` | Input/textarea polimorfico com slot de icone e modo chat |
| **Pressable** | `interaction/Pressable.tsx` | Primitivo interativo universal com acessibilidade via teclado |
| **SearchInput** | `interaction/SearchInput.tsx` | Input pre-configurado com icone de busca |
| **Select** | `interaction/Select.tsx` | Dropdown acessivel com navegacao por teclado |
| **SummaryCard** | `interaction/SummaryCard.tsx` | Cartao de metrica clicavel com label, valor e descricao |
| **ToggleSwitch** | `interaction/ToggleSwitch.tsx` | Switch animado com aria-pressed |
| **TooltipIconAction** | `interaction/TooltipIconAction.tsx` | Icone clicavel com tooltip para casos nao cobertos por `ActionIconButton` |

### Layout

| Componente | Arquivo | O que faz |
|---|---|---|
| **Field** | `layout/Field.tsx` | Wrapper de campo de formulario agrupando label e controle |
| **InactiveListRow** | `layout/InactiveListRow.tsx` | Linha de lista inativa com dimming e simbolos de acento |
| **ListRow** | `layout/ListRow.tsx` | Container de linha de lista com separador, hover e render-prop |
| **Row** | `layout/Row.tsx` | Flexbox horizontal com gap, align, justify e padding X/Y |
| **ScrollableList** | `layout/ScrollableList.tsx` | Container com scrollbar vertical condicional |
| **Section** | `layout/Section.tsx` | Bloco de conteudo com padding padrao para agrupamento logico |
| **Spacer** | `layout/Spacer.tsx` | Espacador flexivel que empurra irmaos para extremidades opostas |
| **Stack** | `layout/Stack.tsx` | Flexbox vertical/horizontal com gap, align e justify |

### Overlay

| Componente | Arquivo | O que faz |
|---|---|---|
| **DataTooltipPrimitives** | `overlay/DataTooltipPrimitives.tsx` | Primitivos textuais para tooltips de dados |
| **DropdownMenu** | `overlay/DropdownMenu.tsx` | Menu suspenso via portal ancorado a qualquer trigger |
| **ImagePreviewOverlay** | `overlay/ImagePreviewOverlay.tsx` | Preview de imagem em tela cheia com backdrop dismiss |
| **Modal** | `overlay/Modal.tsx` | Modal com header, body, footer opcional e tamanho configuravel |
| **ModalFooterActions** | `overlay/ModalFooterActions.tsx` | Rodape padrao de modal com botao cancelar e acao primaria |
| **Overlay** | `overlay/Overlay.tsx` | Overlay base com backdrop escuro, blur e centralizacao |
| **Tooltip** | `overlay/Tooltip.tsx` | Tooltip ancorado ao trigger com flip automatico via portal |

### Surface

| Componente | Arquivo | O que faz |
|---|---|---|
| **Surface** | `surface/Surface.tsx` | Container visual com tone, padding, border-radius e shadow |

### Upload

| Componente | Arquivo | O que faz |
|---|---|---|
| **FilePreview** | `upload/FilePreview.tsx` | Preview de arquivo com barra de progresso, status e overlay |

---

## Patterns

Composicoes construidas sobre foundations. Domain-blind, com comportamento e layout ja definidos.

| Componente | Arquivo | O que faz |
|---|---|---|
| **DeleteConfirmModal** | `DeleteConfirmModal.tsx` | Modal de confirmacao de exclusao com loading state e error handling internos |
| **ExportDropdownButton** | `ExportDropdownButton.tsx` | Botao "Exportar" com dropdown de opcoes PDF e Excel |
| **FilterModal** | `FilterModal.tsx` | Shell de modal de filtros com footer Limpar/Aplicar |
| **SectionHeader** | `SectionHeader.tsx` | Cabecalho de secao com titulo, descricao opcional e slot trailing |

---

## Charts

Componentes de visualizacao de dados. Domain-blind; recebem dados via props.

| Componente | Arquivo | O que faz |
|---|---|---|
| **AreaLineChart** | `AreaLineChart.tsx` | Grafico de linha com area preenchida abaixo da curva |
| **DonutChart** | `DonutChart.tsx` | Grafico de rosca para proporcoes entre categorias |
| **DualAreaLineChart** | `DualAreaLineChart.tsx` | Grafico de linha com duas series e areas sobrepostas |
| **MultiDonutChart** | `MultiDonutChart.tsx` | Multiplos rosquinhas side-by-side para comparacao |
| **PillColumnBarChart** | `PillColumnBarChart.tsx` | Colunas verticais com barras em capsula |
| **SparklineChart** | `SparklineChart.tsx` | Linha compacta sem eixos para uso inline em cards e KPIs |
| **StackedBarChart** | `StackedBarChart.tsx` | Barras empilhadas por categoria |
| **TrapezoidFunnelChart** | `TrapezoidFunnelChart.tsx` | Funil trapezoidal por etapas |

### Chart helpers

| Helper | Arquivo | O que faz |
|---|---|---|
| **chartFrameTokens** | `chartFrameTokens.ts` | Tipos/tokens de frame SVG para charts |
| **chartPalettes** | `chartPalettes.ts` | Resolucao de tons e paletas de charts |
| **chartScales** | `chartScales.ts` | Helpers de escala, ticks e maximos numericos |

Features consomem charts via `@/garden/charts`. Series e labels vao no `domain/` ou `viewModel/` da feature. Proibido SVG de grafico ad hoc na UI da feature.
