// Tela da visão geral; apenas renderiza o view model e reage às interações locais.
import { useState, type ReactNode } from "react";
import type { CommercialDashboardBundle } from "@/core/types/commercialDashboard";
import type { CommercialLocationMetric } from "@/apps/localidades/types/locations";
import { DonutChart, PillColumnBarChart } from "@/garden/charts";
import { Badge, Button, Icon, KpiCard, LoadingScreen, Pressable, Row, Stack, Surface, Text } from "@/garden/foundations";
import { ChartColumnBigIcon, CheckCheckIcon, ChevronRightIcon, GaugeIcon, PrinterIcon, RefreshIcon, SalesChartIcon, UsersIcon } from "@/garden/foundations/assets/icons/icons";
import { TOKENS } from "@/garden/tokens";
import { SALES_OVERVIEW_COPY } from "../copy/salesOverviewCopy";
import { useSalesOverviewController } from "../controller/useSalesOverviewController";
import type { SalesOverviewSnapshot } from "../types/salesOverview";
import type { SalesOverviewViewModel } from "../viewModel/buildSalesOverviewViewModel";

const iconByNav: ReadonlyArray<ReactNode> = [
  <GaugeIcon />, <SalesChartIcon />, <CheckCheckIcon />, <RefreshIcon />, <ChartColumnBigIcon />, <UsersIcon />,
];

function MetricTrend({ value, positiveIsGood = true }: { value: string; positiveIsGood?: boolean }) {
  const isPositive = value.startsWith("+");
  const favorable = positiveIsGood ? isPositive : !isPositive;
  return <Text size="xs" weight={700} tone={null} style={{ color: favorable ? TOKENS.color.feedback.success : TOKENS.color.feedback.warning }}>{value}</Text>;
}

function Sidebar() {
  const [active, setActive] = useState(0);
  return (
    <aside className="app-sidebar" style={{ background: TOKENS.color.surface.sunken, borderRight: `1px solid ${TOKENS.color.stroke.subtle}` }}>
      <Stack gap={TOKENS.spacing[32]} style={{ minHeight: "100%" }}>
        <Row align="center" gap={TOKENS.spacing[12]}>
          <span style={{ width: TOKENS.size[40], height: TOKENS.size[40], borderRadius: TOKENS.radius[12], display: "grid", placeItems: "center", background: TOKENS.color.brand.primary, boxShadow: TOKENS.shadow[2] }}>
            <Text size="lg" weight={800} tone="inverse">N</Text>
          </span>
          <Stack gap={TOKENS.spacing[2]}>
            <Text size="lg" weight={800}>{SALES_OVERVIEW_COPY.product}</Text>
            <Text size="xs" tone="muted">Comercial & performance</Text>
          </Stack>
        </Row>

        <nav aria-label="Navegação principal">
          <Stack gap={TOKENS.spacing[6]}>
            {SALES_OVERVIEW_COPY.nav.map((label, index) => (
              <Pressable key={label} as="button" appearance="bare" aria-current={active === index ? "page" : undefined} onPress={() => setActive(index)}>
                <Row align="center" gap={TOKENS.spacing[12]} style={{ padding: `${TOKENS.spacing[10]} ${TOKENS.spacing[12]}`, borderRadius: TOKENS.radius[10], color: active === index ? TOKENS.color.content.primary : TOKENS.color.content.muted, background: active === index ? TOKENS.color.brand.railItemActive : TOKENS.color.transparent, border: `1px solid ${active === index ? TOKENS.color.brand.borderMuted : TOKENS.color.transparent}` }}>
                  <Icon size="sm" color="currentColor">{iconByNav[index]}</Icon>
                  <Text size="md" weight={active === index ? 700 : 500} tone={null} style={{ color: "inherit", flex: 1 }}>{label}</Text>
                  {active === index && <Icon size="xs" color={TOKENS.color.brand.primary}><ChevronRightIcon /></Icon>}
                </Row>
              </Pressable>
            ))}
          </Stack>
        </nav>

        <Surface tone="subtle" padding={TOKENS.spacing[16]} style={{ marginTop: "auto", border: `1px solid ${TOKENS.color.stroke.default}` }}>
          <Stack gap={TOKENS.spacing[8]}>
            <Text size="xs" weight={700} tone="brand">PRÓXIMA ETAPA</Text>
            <Text size="md" weight={700}>Conectar a base real</Text>
            <Text size="xs" tone="muted" lineHeight={1.5}>A estrutura já está preparada para trocar os dados demonstrativos pela sua fonte.</Text>
          </Stack>
        </Surface>
      </Stack>
    </aside>
  );
}

function DashboardContent({ vm, periodSelector, canPrintReport, isExportingPdf, exportError, onPrintReport }: { vm: SalesOverviewViewModel; periodSelector?: ReactNode; canPrintReport: boolean; isExportingPdf: boolean; exportError: string | null; onPrintReport: () => void }) {
  const points = vm.plans.map((plan) => ({ label: plan.label, value: plan.current }));
  return (
    <main className="app-main">
      <Stack gap={TOKENS.spacing[24]}>
        <header className="page-header">
          <Stack gap={TOKENS.spacing[8]}>
            <Text size="xs" weight={800} tone="brand" style={{ textTransform: "uppercase", letterSpacing: TOKENS.typography.letterSpacing.eyebrow }}>{SALES_OVERVIEW_COPY.eyebrow}</Text>
            <Text size="title-lg" weight={800} block>{SALES_OVERVIEW_COPY.title}</Text>
            <Text size="md" tone="secondary" block>{SALES_OVERVIEW_COPY.description}</Text>
          </Stack>
          <Row align="center" gap={TOKENS.spacing[10]} style={{ flexWrap: "wrap" }}>
            <Badge variant="info">{vm.sourceLabel}</Badge>
            {periodSelector}
          </Row>
        </header>

        <section className="kpi-grid" aria-label="Indicadores principais">
          <KpiCard label="Vendas no mês" value={vm.summary.sales.value} subLabel={vm.summary.sales.trend} subLabelTrend={vm.summary.sales.direction} icon={<SalesChartIcon />} iconColor={TOKENS.color.chart.seriesPrimary} iconBg={TOKENS.color.brand.soft} />
          <KpiCard label="Renovações" value={vm.summary.renewals.value} subLabel={vm.summary.renewals.trend} icon={<CheckCheckIcon />} iconColor={TOKENS.color.feedback.success} iconBg={TOKENS.color.feedback.successSoft} />
          <KpiCard label="Cancelamentos" value={vm.summary.cancellations.value} subLabel={vm.summary.cancellations.trend} icon={<UsersIcon />} iconColor={TOKENS.color.feedback.danger} iconBg={TOKENS.color.feedback.dangerSoft} />
          <KpiCard label="Reativações" value={vm.summary.reactivations.value} subLabel={vm.summary.reactivations.trend} icon={<RefreshIcon />} iconColor={TOKENS.color.feedback.info} iconBg={TOKENS.color.feedback.infoSoft} />
        </section>

        <section className="insight-grid">
          <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
            <Stack gap={TOKENS.spacing[20]}>
              <Row align="flex-start" justify="space-between" gap={TOKENS.spacing[16]}>
                <Stack gap={TOKENS.spacing[4]}>
                  <Text size="xl" weight={800}>{SALES_OVERVIEW_COPY.salesByPlan}</Text>
                  <Text size="sm" tone="muted">{SALES_OVERVIEW_COPY.salesByPlanDescription}</Text>
                </Stack>
                <Row gap={TOKENS.spacing[12]} style={{ flexWrap: "wrap" }}>
                  <Row align="center" gap={TOKENS.spacing[6]}><span className="legend-dot" style={{ background: TOKENS.color.brand.primary }} /><Text size="xs" tone="muted">Atual</Text></Row>
                  <Row align="center" gap={TOKENS.spacing[6]}><span className="legend-dot" style={{ background: TOKENS.color.brand.borderMuted }} /><Text size="xs" tone="muted">Anterior</Text></Row>
                </Row>
              </Row>
              <PillColumnBarChart points={points} formatTooltip={(label, value) => `${label}: ${value} vendas`} chartHeight={260} maxBarHeight={220} ariaLabel="Vendas atuais por plano" />
            </Stack>
          </Surface>

          <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
            <Stack gap={TOKENS.spacing[20]}>
              <Stack gap={TOKENS.spacing[4]}>
                <Text size="xl" weight={800}>{SALES_OVERVIEW_COPY.planMix}</Text>
                <Text size="sm" tone="muted">{SALES_OVERVIEW_COPY.planMixDescription}</Text>
              </Stack>
              <Row align="center" justify="center" gap={TOKENS.spacing[24]} style={{ flexWrap: "wrap", paddingBlock: TOKENS.spacing[12] }}>
                <DonutChart percentage={vm.leadingPlan.percentage} color={TOKENS.color.chart.seriesPrimary} trackColor={TOKENS.color.chart.pastel.primary} size={156} strokeWidth={9} label={`${Math.round(vm.leadingPlan.percentage)}%`} labelSize={24} tooltip={{ heading: vm.leadingPlan.label, metricLabel: "Participação" }} />
                <Stack gap={TOKENS.spacing[8]} style={{ maxWidth: TOKENS.size[200] }}>
                  <Text size="xs" weight={700} tone="brand">PLANO LÍDER</Text>
                  <Text size="lg" weight={800}>{vm.leadingPlan.label}</Text>
                  <Text size="sm" tone="muted">{vm.leadingPlan.value} das vendas do período vieram deste plano.</Text>
                </Stack>
              </Row>
            </Stack>
          </Surface>
        </section>

        <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
          <Stack gap={TOKENS.spacing[20]}>
            <Stack gap={TOKENS.spacing[4]}>
              <Text size="xl" weight={800}>{SALES_OVERVIEW_COPY.operationalPulse}</Text>
              <Text size="sm" tone="muted">{SALES_OVERVIEW_COPY.operationalPulseDescription}</Text>
            </Stack>
            <div className="plan-table" role="table" aria-label="Desempenho por plano">
              <div className="plan-table-head" role="row"><Text size="xs" weight={700} tone="muted">PLANO</Text><Text size="xs" weight={700} tone="muted">VENDAS</Text><Text size="xs" weight={700} tone="muted">PARTICIPAÇÃO</Text><Text size="xs" weight={700} tone="muted">EVOLUÇÃO</Text></div>
              {vm.plans.map((plan) => <div className="plan-table-row" role="row" key={plan.id}><Text size="sm" weight={700}>{plan.fullLabel}</Text><Text size="sm" weight={700}>{plan.current}</Text><Text size="sm" tone="secondary">{plan.share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</Text><MetricTrend value={plan.growth} /></div>)}
            </div>
          </Stack>
        </Surface>

        <Surface tone="subtle" padding={TOKENS.spacing[20]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
          <Row align="center" justify="space-between" gap={TOKENS.spacing[20]} style={{ flexWrap: "wrap" }}>
            <Stack gap={TOKENS.spacing[4]}>
              <Text size="md" weight={800}>{SALES_OVERVIEW_COPY.printReport}</Text>
              <Text size="sm" tone="muted">{SALES_OVERVIEW_COPY.printReportDescription}</Text>
              {exportError && <Text size="xs" tone={null} role="alert" style={{ color: TOKENS.color.feedback.danger }}>{SALES_OVERVIEW_COPY.printReportError}</Text>}
            </Stack>
            <Button size="lg" radius="surface" disabled={!canPrintReport || isExportingPdf} onPress={onPrintReport} aria-label={SALES_OVERVIEW_COPY.printReport}>
              <Row align="center" gap={TOKENS.spacing[8]}><Icon size="sm" color="currentColor"><PrinterIcon /></Icon>{isExportingPdf ? SALES_OVERVIEW_COPY.printingReport : SALES_OVERVIEW_COPY.printReport}</Row>
            </Button>
          </Row>
        </Surface>

        <Text size="xs" tone="subtle" style={{ textAlign: "right" }}>Atualizado em {vm.updatedAt}</Text>
      </Stack>
    </main>
  );
}

export function SalesOverviewPage({ snapshot, dashboard, locationMetrics = [], periodSelector }: { snapshot?: SalesOverviewSnapshot; dashboard?: CommercialDashboardBundle | null; locationMetrics?: ReadonlyArray<CommercialLocationMetric>; periodSelector?: ReactNode }) {
  const { viewModel, isLoading, canPrintReport, isExportingPdf, exportError, printReport } = useSalesOverviewController(snapshot, dashboard, locationMetrics);
  if (isLoading || !viewModel) return <LoadingScreen visible onExitComplete={() => undefined} label="Carregando visão geral comercial" />;
  return <DashboardContent vm={viewModel} periodSelector={periodSelector} canPrintReport={canPrintReport} isExportingPdf={isExportingPdf} exportError={exportError} onPrintReport={() => void printReport()} />;
}
