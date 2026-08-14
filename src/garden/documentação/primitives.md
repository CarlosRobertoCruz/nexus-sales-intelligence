# Garden — Primitives

Cobre `garden/utils/`, `garden/hooks/`, `garden/runtime/`, `garden/providers/`, `garden/types/` e `garden/ui/`.

---

## Regra Central

Tudo aqui e **domain-blind**. Nao conhece regra de negocio, nao importa de `apps/`, nao conhece feature especifica.

- So sobe para o garden quando ja tem 3 consumidores reais (features ou projetos distintos).
- Se houver duvida, fica na feature do projeto atual primeiro.

---

## garden/utils/

Funcoes utilitarias puras sem semantica de produto.

- Preferir funcoes puras e sem efeitos — exceto helpers de plataforma sem semantica de produto (ex.: disparar download de Blob em `utils/browser/`).
- Sem React (exceto quando explicitamente em `garden/ui/` ou `garden/hooks/`).
- Sem semantica de negocio — se tiver regra de negocio, pertence ao `domain/` da feature.

---

## garden/hooks/

Hooks React utilitarios sem semantica de feature.

- Nao pode conhecer dominio de negocio.
- Nao pode importar de `apps/`.
- So sobe se for generico e reutilizavel.

---

## garden/runtime/

Ciclos operacionais genericos (motores de upload, audio, etc.).

- Nao decide negocio, nao formata UI.
- So sobe se o ciclo servir multiplas features ou projetos.

---

## garden/providers/

Providers React que provisionam contexto de infraestrutura generica (upload, audio).

- Sem semantica de produto.
- Deve ser wrapado na raiz do projeto se necessario.

---

## garden/types/

Tipos genericos do Garden, sem semantica de produto.

- Nao pode importar de `apps/`.
- Nao pode importar de `core/`.
- Nao pode modelar entidades de negocio.
- Deve existir apenas quando mais de uma area do Garden precisa compartilhar o mesmo shape.

---

## garden/ui/

Componentes React compartilhados que conhecem linguagem de produto mas nao regra de feature especifica.

- Pode conhecer linguagem de produto.
- Nao pode conhecer regra de feature especifica.
- Nao pode depender de controller, domain, services ou state de feature.
- So sobe com 3 usos reais, API estavel e sem regra de feature embutida.

---

## Catalogo

Inventario oficial. Qualquer adicao deve ser registrada aqui.

### garden/utils/

#### array/

| Funcao | Arquivo | O que faz |
|---|---|---|
| **paginateSlice** | `utils/array/paginateSlice.ts` | Devolve a fatia de um array para pagina client-side (pagina 1-based, tamanho de pagina; normaliza `page`/`pageSize` para minimos seguros) |

#### date/

| Funcao | Arquivo | O que faz |
|---|---|---|
| **toTimestamp** | `utils/date/toTimestamp.ts` | Coerce number/Date/ISO string para ms; invalido → null |
| **toSafeTimestamp** | `utils/date/toSafeTimestamp.ts` | Coerce para ms com fallback 0; util para ordenacao |
| **getCurrentTimestamp** | `utils/date/getCurrentTimestamp.ts` | Wrapper de Date.now() para isolamento em domain |
| **isSameLocalCalendarDay** | `utils/date/isSameLocalCalendarDay.ts` | Compara dois timestamps para mesmo dia local |
| **isoDate** | `utils/date/isoDate.ts` | Parse/format de ISO date, day index algebra, shiftIsoDate |
| **formatPtBrHourMinute** | `utils/date/formatPtBrHourMinute.ts` | Formata timestamp como HH:MM em pt-BR |
| **formatPtBrDateOnly** | `utils/date/formatPtBrDateOnly.ts` | Formata instante ISO/timestamp como DD/MM/AAAA em pt-BR (invalido → string vazia) |
| **formatPtBrDateTime** | `utils/date/formatPtBrDateTime.ts` | Formata ISO/timestamp como DD/MM/YYYY HH:MM em pt-BR |
| **formatIsoDateOnlyPtBr** | `utils/date/formatIsoDateOnlyPtBr.ts` | Converte ISO date (`YYYY-MM-DD`) para `dd/mm/aaaa` para exibicao |
| **formatDurationFromMinutes** | `utils/date/formatDurationFromMinutes.ts` | Converte minutos inteiros para formato legivel (`0min`, `2h 5min`) |
| **formatDurationFromSeconds** | `utils/date/formatDurationFromSeconds.ts` | Converte segundos para HH:MM:SS |
| **parseDurationHmsToSeconds** | `utils/date/parseDurationHmsToSeconds.ts` | Interpreta `HH:MM:SS` para segundos; invalido -> `null` |
| **getIsoDateRangeForRelativePeriodPreset** / **matchRelativePeriodPreset** | `utils/date/relativeIsoPeriodRange.ts` | Intervalos ISO por preset relativo (`today`, `yesterday`, `last7`, `last15`, `last30`, `last60`, `last90`, `last365`) |

#### string/

| Funcao | Arquivo | O que faz |
|---|---|---|
| **normalizeSearch** | `utils/string/normalizeSearch.ts` | Normaliza qualquer valor para chave de busca lowercase sem espacos |
| **trimmedOrCellPlaceholder** | `utils/string/trimmedOrCellPlaceholder.ts` | Trim + placeholder padrao para celulas vazias |
| **isValidEmailBasic** | `utils/string/isValidEmailBasic.ts` | Teste simples de e-mail (`local@dominio.tld`) |
| **isTrimmedLengthAtLeast** | `utils/string/isTrimmedLengthAtLeast.ts` | Comprimento minimo apos `trim` |
| **formatCpfDigitsInputDisplay** | `utils/string/formatCpfDigitsInputDisplay.ts` | Mascara de CPF (11 digitos) para valor de input |
| **formatBrPhoneDigitsInputDisplay** | `utils/string/formatBrPhoneDigitsInputDisplay.ts` | Mascara de telefone BR (ate 11 digitos) para valor de input |
| **extractBrazilNationalPhoneDigits** | `utils/string/extractBrazilNationalPhoneDigits.ts` | Extrai digitos nacionais de telefone BR |
| **slugify** | `utils/string/slugify.ts` | Normaliza texto para slug URL (lowercase, sem acentos, hifens entre segmentos) |

#### form/

| Funcao | Arquivo | O que faz |
|---|---|---|
| **validateCadastroPasswordPair** / **CadastroPasswordPairError** | `utils/form/validateCadastroPasswordPair.ts` | Par senha + confirmar em cadastro: create obriga minimo 8 e igualdade; edit so valida se algum campo tiver texto |

#### error/

| Funcao | Arquivo | O que faz |
|---|---|---|
| **messageFromUnknownError** | `utils/error/messageFromUnknownError.ts` | Extrai `message` de `Error` em ramos `catch`; caso contrario devolve `fallback` |

#### name/

| Funcao | Arquivo | O que faz |
|---|---|---|
| **getNameInitials** | `utils/name/getNameInitials.ts` | Extrai ate 2 iniciais de nome em PT-BR ignorando particulas (de/da/do/junior/etc) |

#### number/

| Funcao | Arquivo | O que faz |
|---|---|---|
| **formatPtBrOneDecimal** | `utils/number/formatPtBrOneDecimal.ts` | Formata numero com 1 casa decimal em pt-BR |
| **formatPtBrTwoDecimals** | `utils/number/formatPtBrTwoDecimals.ts` | Formata numero com 2 casas decimais em pt-BR |
| **formatPtBrInteger** | `utils/number/formatPtBrInteger.ts` | Formata numero inteiro em pt-BR |
| **formatBytesDisplay** | `utils/number/formatBytesDisplay.ts` | Compacta bytes para unidade legivel (B/KB/MB/GB) |
| **formatCompactCount** | `utils/number/formatCompactCount.ts` | Contagem compacta (ex.: 1.2k) |
| **formatLinkRateValue** | `utils/number/formatLinkRateValue.ts` | Formata taxa de link (Mbps/Gbps) |
| **parseSizeLabelToMb** | `utils/number/parseSizeLabel.ts` | Interpreta string de tamanho legivel (`"1.2 MB"`, `"512 KB"`) e devolve valor em MB; invalido -> 0 |
| **parseLeadingNumber** | `utils/number/parseLeadingNumber.ts` | Extrai o primeiro inteiro de uma string (ex.: `"6 (auto)"` → `6`) |
| **parseBandwidthMhz** | `utils/number/parseBandwidthMhz.ts` | Extrai a maior largura em MHz de labels como `"20/40 MHz"` |

#### browser/

| Funcao | Arquivo | O que faz |
|---|---|---|
| **downloadBlob** | `utils/browser/downloadBlob.ts` | Dispara download de um Blob no browser; `filename` definido pelo caller |
| **ensureAbsoluteHttpUrl** | `utils/browser/ensureAbsoluteHttpUrl.ts` | Garante que uma URL tenha esquema http/https |

#### upload/

| Funcao | Arquivo | O que faz |
|---|---|---|
| **isUploadImageFile** | `utils/upload/isUploadImageFile.ts` | Verifica se um arquivo e imagem pelo MIME type |
| **resolveBrowserUploadUrl** | `utils/upload/resolveBrowserUploadUrl.ts` | Resolve URL de preview de upload no browser |

#### export/

| Funcao | Arquivo | O que faz |
|---|---|---|
| **reportExportStyle** | `utils/export/reportExportStyle.ts` | Estilos para exportacao de relatorios (Excel/PDF), alinhado aos tokens |

---

### garden/hooks/

#### interaction/

| Hook | Arquivo | O que faz |
|---|---|---|
| **useClickOutside** | `hooks/interaction/useClickOutside.ts` | Dispara callback em mousedown fora do ref |
| **useEscapeKey** | `hooks/interaction/useEscapeKey.ts` | Dispara callback em ESC global |
| **useDebounce** | `hooks/interaction/useDebounce.ts` | Atrasa valor por duracao configuravel (default 180ms) |

#### upload/

| Hook | Arquivo | O que faz |
|---|---|---|
| **useFileUpload** | `hooks/upload/useFileUpload.ts` | Estado de uploads em progresso; orquestra uploadEngine; revoga object URLs |
| **useGlobalDragUpload** | `hooks/upload/useGlobalDragUpload.ts` | Captura drag/drop na window e alimenta useFileUpload |
| **usePasteUpload** | `hooks/upload/usePasteUpload.ts` | Captura paste de imagem na window e alimenta useFileUpload |
| **useUpload** | `hooks/upload/useUpload.ts` | Consome UploadContext; falha cedo se fora do UploadProvider |

---

### garden/runtime/

| Runtime | Arquivo | O que faz |
|---|---|---|
| **uploadEngine** | `runtime/upload/uploadEngine.ts` | Motor de upload (progresso, conclusao, cancel, falha); sem decisao de negocio |
| **soundEngine** | `runtime/sound/soundEngine.ts` | Motor de audio generico para feedback sonoro |

---

### garden/providers/

| Provider | Arquivo | O que faz |
|---|---|---|
| **UploadProvider** | `providers/upload/UploadProvider.tsx` | Instancia useFileUpload na raiz e provisiona via UploadContext |
| **UploadContext** | `providers/upload/uploadContext.ts` | Context React com handle de upload e flag isDragging |

---

### garden/types/

| Tipo | Arquivo | O que faz |
|---|---|---|
| **FileItem** / **UploadStatus** | `types/upload.ts` | Shape generico de arquivo em fluxo de upload |
| **SelectOption** | `types/selectOption.ts` | Shape generico value/label de opcao de select (fonte canonica; foundations/Select re-exporta) |
| **RelativePeriodPresetKey** / **RelativePeriodMatchResult** | `types/datePeriod.ts` | Presets de periodo relativo ISO (`today`, `last7`, …) e resultado `custom` (fonte canonica; utils/date re-exporta) |

---

### garden/ui/

#### date/

| Componente | Arquivo | O que faz |
|---|---|---|
| **CalendarDatePicker** | `ui/date/CalendarDatePicker.tsx` | Seletor de data unica com navegacao de mes e ISO date onChange |
| **CalendarDateRangePicker** | `ui/date/CalendarDateRangePicker.tsx` | Seletor de intervalo de datas com draft/apply e visualizacao de range |

#### form/

| Componente | Arquivo | O que faz |
|---|---|---|
| **PasswordInputWithToggle** | `ui/form/PasswordInputWithToggle.tsx` | Campo `Input` tipo senha com botao de revelar/ocultar; opcional `icon` e `size` |

#### filter/

| Componente | Arquivo | O que faz |
|---|---|---|
| **FilterInput** | `ui/filter/FilterInput.tsx` | Input de busca padrao para listas; sem debounce ou normalizacao interna |

#### upload/

| Componente | Arquivo | O que faz |
|---|---|---|
| **DropOverlay** | `ui/upload/DropOverlay.tsx` | Overlay visual na area de drop; visivel via prop `visible` |
| **UploadInput** | `ui/upload/UploadInput.tsx` | Input de arquivo invisivel vinculado ao useFileUpload |
