# Core Contract

Cobre `src/core/*` — camada compartilhada entre features que **conhece linguagem de produto**
(diferente do Garden, que é domain-blind). Critério de promoção já existe em
`01-review-guide.md` §Promoção: *"é compartilhado mas conhece linguagem do produto: considerar
core"*. Este contrato formaliza o que cada subpasta de `core/` pode/não pode fazer.

---

## Estrutura hoje

```txt
core/
  types/         # tipos canonicos compartilhados entre 2+ features (ja coberto por 70-types.md)
    metricas/    # os 18 tipos do dominio metricas, espelhando core/domain/metricas/
  domain/        # funcoes puras / classifiers compartilhados entre features (ex.: metricas/)
  ui/            # modulos de UI compartilhados que conhecem produto (ex.: brand/, loading/)
```

Não existe `core/services/` nem `core/controller/` hoje — quando um service precisa ser
compartilhado entre features de um mesmo domínio, o padrão já em uso é `@/apps/onu/services/`
(ex. `onuSummaryMapper.ts`), tratado como equivalente de `core/services` (ver `40-services.md`,
`00-architecture.md`). Não criar `core/services/` preventivamente.

---

## `core/types/`

Já coberto por [`70-types.md`](./70-types.md) — mesmas regras de `feature/types`, promovido só
quando o tipo repete em 2+ features. Nenhuma regra adicional aqui.

**Estrutura (22/07)**: `core/types/metricas/` reúne os 18 tipos do mesmo domínio de
`core/domain/metricas/` (mesmo agrupamento, 1:1 — ex. `metricas/healthScore.ts` tipo +
`core/domain/metricas/domain/healthScore.ts` regra); `clientSearch.ts` fica sozinho na raiz por
não ser desse domínio (não ganha subpasta própria por ser só 1 arquivo — sem pasta preventiva
pra 1 item só). Quando surgir um 2º tipo fora do domínio de métrica, considerar subpasta própria
pra ele também nesse momento, não antes.

**Exceção de import — `@shared/*.json` (23/07)**: os 4 arquivos de `core/types/metricas/`
(`opticalPower`, `deviceTemperature`, `deviceCpuUsage`, `healthScore`) importam
`@shared/health-thresholds.json` — alias Vite/tsconfig pra `app/shared/`, pasta irmã de
`client`/`server` com o JSON de thresholds que os dois lados leem (client via `import`, server via
`fs.readFileSync` em runtime). É a única exceção ao mapa de imports comum de `core/types`: fonte
única aprovada pra evitar duplicar constante de saúde entre client e server (motivo original em
`overview.classify.ts`, ver `docs/NDS_Auditoria_Frontend_VisaoGeral.md`). Vale só pra dado estático
default compartilhado com o backend — não abre precedente pra `core/types` importar qualquer coisa
de fora de `src/`.

## `core/domain/`

### Responsabilidade

- Funções puras / classifiers reusados por 2+ features — ex.: `core/domain/metricas/domain/*`
  (saúde, sinal óptico, Wi-Fi), reusado hoje por `onu/wifi`, `onu/informacoes`, `onu/saude`,
  `onu/diagnostico`, `onu/dispositivos`.
- Mesma regra de pureza do `30-domain.md`: sem React, sem browser, sem state, sem service, sem
  runtime, sem efeito colateral.
- Catálogo de dados estáticos que acompanha a regra (ex. `metricas/catalog/`) pode viver junto do
  módulo, numa subpasta `catalog/` irmã de `domain/` — não é `garden/foundations` (não é UI) nem
  `core/types` (tem função, não só shape).

### Pode importar

- `core/types`
- `garden/utils`
- `garden/types`

### Não pode importar

- React, browser, UI/foundations, state, services, runtime, `@/api/*` — mesma lista proibida do
  `30-domain.md`, sem exceção por estar em `core/`.
- `feature/*` de qualquer app — `core/domain` é importado por feature, nunca o contrário.

### Regras

- Promover pra `core/domain` só quando a função já repete em 2+ features (mesmo critério do
  `01-review-guide.md` §Promoção) — antes disso, fica em `feature/domain`.
- Nome de módulo por área de domínio (ex. `metricas/`), não por feature consumidora.
- Consumidores importam `core/domain` normalmente por `domain/` ou `viewModel/` da própria
  feature (`30-domain.md`/`16-viewModel.md` já documentam essa permissão) — nunca direto por
  `controller/`/`ui/`.

## `core/ui/`

### Responsabilidade

- Módulo de UI compartilhado entre 3+ features que **conhece linguagem de produto** (nome de
  marca, fabricante, identidade visual real) — por isso não pode ser Garden (domain-blind).
  Exemplos hoje: `core/ui/brand/` (logo/foto por marca/fabricante/chipset) e `core/ui/loading/`
  (tela de conexão com a marca NDS).
- Cada módulo é autocontido: `assets/` (imagens), `ui/` (componente React), `viewModel/`
  (resolvers puros string→string, sem React) quando existir.

### Pode importar

- `garden/*` (foundations, tokens, utils, patterns).
- Assets próprios do módulo.

### Não pode importar

- `feature/*` de qualquer app — `core/ui` é importado por feature, nunca o contrário.
- `@/api/*`, services, domain de feature.

### Regras

- Promover pra `core/ui` só quando o módulo deixar de ser exclusivo de uma feature e passar a
  ser reusado por 3+ áreas do site (mesmo critério do `01-review-guide.md` §Promoção) — critério
  real já aplicado: `core/ui/brand` foi promovido de `apps/onu/*` em 2026-07-19 quando passou a
  ser usado fora da tela de ONU.
- **Exceção de import já documentada em `10-ui.md`** (não duplicar aqui, só referenciar): `ui/`
  de qualquer feature pode importar `core/ui/brand/ui/*` e `core/ui/brand/assets/*` direto;
  `controller/`/`viewModel/` de qualquer feature podem importar os 3 resolvers puros de
  `core/ui/brand/viewModel/*` (`resolveBrandLogo`, `resolveManufacturerLogo`,
  `resolveChipsetLogo`), furo estreito só pra esses três arquivos.
- Assets: preferir `.webp` (ver conversão feita em 21/07 nos ícones de marca/chipset/fabricante);
  manter o `.png` original só quando o `.webp` sair maior (achado real: `hisilicon.webp` foi
  revertido por esse motivo).

---

## Regra Suprema

Se qualquer sugestao conflitar com este contrato: seguir o contrato.
