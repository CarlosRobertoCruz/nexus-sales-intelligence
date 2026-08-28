import { createContext, useContext, type ReactNode } from "react";
import { GroupedColumnChart, MultiDonutChart } from "@/garden/charts";
import { Badge, KpiCard, LoadingScreen, Row, Stack, Surface, Text } from "@/garden/foundations";
import { ArrowRightLeftIcon, BookmarkIcon, CheckCheckIcon, SparklesIcon } from "@/garden/foundations/assets/icons/icons";
import { TOKENS } from "@/garden/tokens";
import { RENEWALS_COPY } from "../copy/renewalsCopy";
import { useRenewalsController } from "../controller/useRenewalsController";
import type { RenewalsSnapshot } from "../types/renewals";
import type { RenewalsViewModel } from "../viewModel/buildRenewalsViewModel";

const chartFrame = {
  gridLine: TOKENS.color.stroke.subtle,
  textMuted: TOKENS.color.content.muted,
  textPrimary: TOKENS.color.content.primary,
  textSubtle: TOKENS.color.content.subtle,
  tooltipBackground: TOKENS.color.surface.elevated,
  tooltipBorder: TOKENS.color.stroke.strong,
  tooltipInverseBackground: TOKENS.color.surface.inverse,
  tooltipInverseText: TOKENS.color.surface.base,
};

const benefitColors = [TOKENS.color.brand.primary, TOKENS.color.chart.info, TOKENS.color.chart.positive, TOKENS.color.chart.warning, TOKENS.color.category.accentPink, TOKENS.color.chart.neutral] as const;

const PeriodSelectorContext = createContext<ReactNode>(null);

function Header({ vm }: { vm: RenewalsViewModel }) {
  const periodSelector = useContext(PeriodSelectorContext);
  return <header className="page-header"><Stack gap={TOKENS.spacing[8]}><Text size="xs" weight={800} tone="brand" style={{ textTransform: "uppercase", letterSpacing: TOKENS.typography.letterSpacing.eyebrow }}>{RENEWALS_COPY.eyebrow}</Text><Text size="title-lg" weight={800} block>{RENEWALS_COPY.title}</Text><Text size="md" tone="secondary" block>{RENEWALS_COPY.description}</Text></Stack><Row align="center" gap={TOKENS.spacing[10]} style={{ flexWrap: "wrap" }}><Badge variant="info">{vm.sourceLabel}</Badge>{periodSelector}</Row></header>;
}

function Benefits({ vm }: { vm: RenewalsViewModel }) {
  const segments = vm.benefits.map((benefit, index) => ({ percentage: benefit.share, color: benefitColors[index % benefitColors.length] }));
  return <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}><Stack gap={TOKENS.spacing[20]}><Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{RENEWALS_COPY.benefitsTitle}</Text><Text size="sm" tone="muted">{RENEWALS_COPY.benefitsDescription}</Text></Stack><div className="benefits-content"><MultiDonutChart segments={segments} trackColor={TOKENS.color.stroke.subtle} size={190} strokeWidth={10} tooltip={{ heading: "Benefícios concedidos", valueLabels: vm.benefits.map((benefit) => benefit.label), counts: vm.benefits.map((benefit) => benefit.count) }}><Stack align="center" gap={TOKENS.spacing[2]}><Text size="value" weight={800}>{vm.summary.total}</Text><Text size="xs" tone="muted">renovações</Text></Stack></MultiDonutChart><Stack gap={TOKENS.spacing[10]} style={{ flex: 1 }}>{vm.benefits.map((benefit, index) => <Row key={benefit.id} align="center" gap={TOKENS.spacing[10]}><span className="benefit-dot" style={{ background: benefitColors[index % benefitColors.length] }} /><Stack gap={TOKENS.spacing[2]} style={{ flex: 1 }}><Text size="sm" weight={700}>{benefit.label}</Text><Text size="xs" tone="muted">{benefit.share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do total</Text></Stack><Text size="sm" weight={800}>{benefit.count}</Text></Row>)}</Stack></div></Stack></Surface>;
}

function Plans({ vm }: { vm: RenewalsViewModel }) {
  const maximum = Math.max(...vm.plans.map((plan) => plan.count), 1);
  return <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}><Stack gap={TOKENS.spacing[20]}><Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{RENEWALS_COPY.plansTitle}</Text><Text size="sm" tone="muted">{RENEWALS_COPY.plansDescription}</Text></Stack><Stack gap={TOKENS.spacing[16]}>{vm.plans.map((plan, index) => <Stack key={plan.label} gap={TOKENS.spacing[8]}><Row align="center" justify="space-between" gap={TOKENS.spacing[12]}><Text size="sm" weight={700} truncate title={plan.label}>{plan.label}</Text><Text size="sm" weight={800}>{plan.count}</Text></Row><div className="renewal-plan-track"><div style={{ width: `${(plan.count / maximum) * 100}%`, background: index === 0 ? TOKENS.color.brand.primary : TOKENS.color.brand.borderMuted }} /></div></Stack>)}</Stack></Stack></Surface>;
}

function Recent({ vm }: { vm: RenewalsViewModel }) {
  return <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}><Stack gap={TOKENS.spacing[20]}><Row align="flex-start" justify="space-between" gap={TOKENS.spacing[16]}><Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{RENEWALS_COPY.recentTitle}</Text><Text size="sm" tone="muted">{RENEWALS_COPY.recentDescription}</Text></Stack><Badge variant="neutral">{vm.recentRenewals.length} registros</Badge></Row><div className="renewals-table" role="table" aria-label="Renovações recentes"><div className="renewals-table-head" role="row"><Text size="xs" weight={700} tone="muted">RENOVAÇÃO</Text><Text size="xs" weight={700} tone="muted">CLIENTE</Text><Text size="xs" weight={700} tone="muted">PLANO</Text><Text size="xs" weight={700} tone="muted">BENEFÍCIO</Text><Text size="xs" weight={700} tone="muted">VENDEDOR</Text><Text size="xs" weight={700} tone="muted">STATUS</Text></div>{vm.recentRenewals.map((renewal) => <div className="renewals-table-row" role="row" key={renewal.id}><Stack gap={TOKENS.spacing[2]}><Text size="xs" weight={700} truncate title={renewal.id}>{renewal.id}</Text><Text size="xs" tone="muted">{renewal.date}</Text></Stack><Text size="sm" weight={600} truncate title={renewal.customer}>{renewal.customer}</Text><Text size="sm" tone="secondary" truncate title={renewal.plan}>{renewal.plan}</Text><Text size="sm" truncate title={renewal.benefit}>{renewal.benefit}</Text><Text size="sm" truncate title={renewal.seller}>{renewal.seller}</Text><Badge size="sm" variant={renewal.status === "Concluída" ? "success" : "warning"}>{renewal.status}</Badge></div>)}</div></Stack></Surface>;
}

function Content({ vm }: { vm: RenewalsViewModel }) {
  return <main className="app-main"><Stack gap={TOKENS.spacing[24]}><Header vm={vm} /><section className="kpi-grid" aria-label="Indicadores de renovações"><KpiCard label="Renovações no mês" value={vm.summary.total} subLabel={vm.summary.growth} subLabelTrend="down" icon={<CheckCheckIcon />} iconColor={TOKENS.color.chart.seriesPrimary} iconBg={TOKENS.color.brand.soft} /><KpiCard label="Principal benefício" value={vm.summary.mainBenefit} subLabel={vm.summary.mainBenefitShare} icon={<SparklesIcon />} iconColor={TOKENS.color.feedback.warning} iconBg={TOKENS.color.feedback.warningSoft} /><KpiCard label="Sem benefício adicional" value={vm.summary.withoutBenefit} subLabel={vm.summary.withoutBenefitShare} icon={<BookmarkIcon />} iconColor={TOKENS.color.feedback.info} iconBg={TOKENS.color.feedback.infoSoft} /><KpiCard label="Plano mais renovado" value={vm.summary.topPlan} subLabel={vm.summary.topPlanShare} icon={<ArrowRightLeftIcon />} iconColor={TOKENS.color.feedback.success} iconBg={TOKENS.color.feedback.successSoft} /></section><Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}><Stack gap={TOKENS.spacing[20]}><Row align="flex-start" justify="space-between" gap={TOKENS.spacing[16]}><Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{RENEWALS_COPY.trendTitle}</Text><Text size="sm" tone="muted">{RENEWALS_COPY.trendDescription}</Text></Stack><Row gap={TOKENS.spacing[14]}><Row align="center" gap={TOKENS.spacing[6]}><span className="legend-dot" style={{ background: TOKENS.color.brand.primary }} /><Text size="xs" tone="muted">{vm.comparison.currentLabel}</Text></Row><Row align="center" gap={TOKENS.spacing[6]}><span className="legend-dot" style={{ background: TOKENS.color.content.subtle }} /><Text size="xs" tone="muted">{vm.comparison.previousLabel}</Text></Row></Row></Row><GroupedColumnChart labels={vm.trend.labels} primaryValues={vm.trend.current} secondaryValues={vm.trend.previous} primaryLabel={vm.comparison.currentLabel} secondaryLabel={vm.comparison.previousLabel} primaryColor={TOKENS.color.brand.primary} secondaryColor={TOKENS.color.content.subtle} frame={chartFrame} height={260} ariaLabel="Comparativo mensal das renovações" /></Stack></Surface><section className="renewals-insight-grid"><Benefits vm={vm} /><Plans vm={vm} /></section><Recent vm={vm} /><Text size="xs" tone="subtle" style={{ textAlign: "right" }}>Atualizado em {vm.updatedAt}</Text></Stack></main>;
}

export function RenewalsPage({ snapshot, periodSelector }: { snapshot?: RenewalsSnapshot; periodSelector?: ReactNode }) {
  const { viewModel, isLoading } = useRenewalsController(snapshot);
  if (isLoading || !viewModel) return <LoadingScreen visible onExitComplete={() => undefined} label="Carregando análise de renovações" />;
  return <PeriodSelectorContext.Provider value={periodSelector}><Content vm={viewModel} /></PeriodSelectorContext.Provider>;
}
