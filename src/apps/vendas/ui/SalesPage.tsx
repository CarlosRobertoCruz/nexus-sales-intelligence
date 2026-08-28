// Tela de vendas; renderiza indicadores e comparações sem decidir regras de negócio.
import type { ReactNode } from "react";
import { GroupedColumnChart } from "@/garden/charts";
import { Badge, KpiCard, LoadingScreen, Row, Stack, Surface, Text } from "@/garden/foundations";
import { ChartColumnBigIcon, SalesChartIcon, SparklesIcon, UsersIcon } from "@/garden/foundations/assets/icons/icons";
import { TOKENS } from "@/garden/tokens";
import { SALES_COPY } from "../copy/salesCopy";
import { useSalesController } from "../controller/useSalesController";
import type { SalesSnapshot } from "../types/sales";
import type { SalesViewModel } from "../viewModel/buildSalesViewModel";

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

function PageHeader({ vm, periodSelector }: { vm: SalesViewModel; periodSelector?: ReactNode }) {
  return (
    <header className="page-header">
      <Stack gap={TOKENS.spacing[8]}>
        <Text size="xs" weight={800} tone="brand" style={{ textTransform: "uppercase", letterSpacing: TOKENS.typography.letterSpacing.eyebrow }}>{SALES_COPY.eyebrow}</Text>
        <Text size="title-lg" weight={800} block>{SALES_COPY.title}</Text>
        <Text size="md" tone="secondary" block>{SALES_COPY.description}</Text>
      </Stack>
      <Row align="center" gap={TOKENS.spacing[10]} style={{ flexWrap: "wrap" }}>
        <Badge variant="info">{vm.sourceLabel}</Badge>
        {periodSelector}
      </Row>
    </header>
  );
}

function PlanComparison({ vm }: { vm: SalesViewModel }) {
  return (
    <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
      <Stack gap={TOKENS.spacing[20]}>
        <Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{SALES_COPY.plansTitle}</Text><Text size="sm" tone="muted">{SALES_COPY.plansDescription}</Text></Stack>
        <Stack gap={TOKENS.spacing[16]}>
          {vm.plans.map((plan) => (
            <div className="plan-comparison-row" key={plan.label}>
              <Stack gap={TOKENS.spacing[4]}><Text size="sm" weight={700} truncate title={plan.label}>{plan.label}</Text><Text size="xs" tone="muted">{plan.growth} no período</Text></Stack>
              <Stack gap={TOKENS.spacing[8]}>
                <Row align="center" gap={TOKENS.spacing[8]}><Text size="xs" tone="muted" style={{ width: TOKENS.size[48] }}>Atual</Text><div className="comparison-track"><div style={{ width: `${(plan.current / Math.max(1, plan.max)) * 100}%`, background: TOKENS.color.brand.primary }} /></div><Text size="xs" weight={700}>{plan.current}</Text></Row>
                <Row align="center" gap={TOKENS.spacing[8]}><Text size="xs" tone="muted" style={{ width: TOKENS.size[48] }}>Anterior</Text><div className="comparison-track"><div style={{ width: `${(plan.previous / Math.max(1, plan.max)) * 100}%`, background: TOKENS.color.brand.borderMuted }} /></div><Text size="xs" weight={700}>{plan.previous}</Text></Row>
              </Stack>
            </div>
          ))}
        </Stack>
      </Stack>
    </Surface>
  );
}

function SellerRanking({ vm }: { vm: SalesViewModel }) {
  return (
    <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
      <Stack gap={TOKENS.spacing[20]}>
        <Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{SALES_COPY.rankingTitle}</Text><Text size="sm" tone="muted">{SALES_COPY.rankingDescription}</Text></Stack>
        <Stack gap={TOKENS.spacing[10]}>
          {vm.sellers.map((seller) => {
            const positive = seller.growth.startsWith("+");
            return <Row key={seller.id} align="center" gap={TOKENS.spacing[12]} style={{ padding: TOKENS.spacing[12], borderRadius: TOKENS.radius[10], background: seller.position === 1 ? TOKENS.color.brand.fillSubtle : TOKENS.color.surface.card, border: `1px solid ${seller.position === 1 ? TOKENS.color.brand.borderMuted : TOKENS.color.stroke.subtle}` }}>
              <span className="rank-number"><Text size="sm" weight={800} tone={seller.position === 1 ? "brand" : "muted"}>{seller.position}</Text></span>
              <Stack gap={TOKENS.spacing[2]} style={{ flex: 1 }}><Text size="md" weight={800}>{seller.name}</Text><Text size="xs" tone="muted">{seller.previous} no mês anterior</Text></Stack>
              <Stack align="flex-end" gap={TOKENS.spacing[2]}><Text size="lg" weight={800}>{seller.current}</Text><Text size="xs" weight={700} tone={null} style={{ color: positive ? TOKENS.color.feedback.success : TOKENS.color.feedback.warning }}>{seller.growth}</Text></Stack>
            </Row>;
          })}
        </Stack>
      </Stack>
    </Surface>
  );
}

function RecentSales({ vm }: { vm: SalesViewModel }) {
  return (
    <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
      <Stack gap={TOKENS.spacing[20]}>
        <Row align="flex-start" justify="space-between" gap={TOKENS.spacing[16]}><Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{SALES_COPY.recentTitle}</Text><Text size="sm" tone="muted">{SALES_COPY.recentDescription}</Text></Stack><Badge variant="neutral">{vm.recentSales.length} registros</Badge></Row>
        <div className="sales-table" role="table" aria-label="Vendas recentes">
          <div className="sales-table-head" role="row"><Text size="xs" weight={700} tone="muted">VENDA</Text><Text size="xs" weight={700} tone="muted">CLIENTE</Text><Text size="xs" weight={700} tone="muted">PLANO</Text><Text size="xs" weight={700} tone="muted">VENDEDOR</Text><Text size="xs" weight={700} tone="muted">LOCALIDADE</Text><Text size="xs" weight={700} tone="muted">STATUS</Text></div>
          {vm.recentSales.map((sale) => <div className="sales-table-row" role="row" key={sale.id}><Stack gap={TOKENS.spacing[2]}><Text size="sm" weight={700}>{sale.id}</Text><Text size="xs" tone="muted">{sale.date}</Text></Stack><Text size="sm" weight={600}>{sale.customer}</Text><Text size="sm" tone="secondary" truncate title={sale.plan}>{sale.plan}</Text><Text size="sm">{sale.seller}</Text><Text size="sm">{sale.location}</Text><Badge size="sm" variant={sale.status === "Instalado" ? "success" : sale.status === "Desistência" ? "danger" : "warning"}>{sale.status}</Badge></div>)}
        </div>
      </Stack>
    </Surface>
  );
}

function SalesContent({ vm, periodSelector }: { vm: SalesViewModel; periodSelector?: ReactNode }) {
  return <main className="app-main"><Stack gap={TOKENS.spacing[24]}>
    <PageHeader vm={vm} periodSelector={periodSelector} />
    <section className="kpi-grid" aria-label="Indicadores de vendas">
      <KpiCard label="Vendas no mês" value={vm.summary.total} subLabel={vm.summary.growth} subLabelTrend="up" icon={<SalesChartIcon />} iconColor={TOKENS.color.chart.seriesPrimary} iconBg={TOKENS.color.brand.soft} />
      <KpiCard label="Líder comercial" value={vm.summary.leader} subLabel={vm.summary.leaderSales} icon={<SparklesIcon />} iconColor={TOKENS.color.feedback.warning} iconBg={TOKENS.color.feedback.warningSoft} />
      <KpiCard label="Plano mais vendido" value={vm.summary.topPlan} subLabel={vm.summary.topPlanShare} icon={<ChartColumnBigIcon />} iconColor={TOKENS.color.feedback.info} iconBg={TOKENS.color.feedback.infoSoft} />
      <KpiCard label="Média por vendedor" value={vm.summary.averagePerSeller} subLabel="vendas por pessoa" icon={<UsersIcon />} iconColor={TOKENS.color.feedback.success} iconBg={TOKENS.color.feedback.successSoft} />
    </section>
    <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
      <Stack gap={TOKENS.spacing[20]}><Row align="flex-start" justify="space-between" gap={TOKENS.spacing[16]}><Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{SALES_COPY.trendTitle}</Text><Text size="sm" tone="muted">{SALES_COPY.trendDescription}</Text></Stack><Row gap={TOKENS.spacing[14]}><Row align="center" gap={TOKENS.spacing[6]}><span className="legend-dot" style={{ background: TOKENS.color.brand.primary }} /><Text size="xs" tone="muted">{vm.comparison.currentLabel}</Text></Row><Row align="center" gap={TOKENS.spacing[6]}><span className="legend-dot" style={{ background: TOKENS.color.content.subtle }} /><Text size="xs" tone="muted">{vm.comparison.previousLabel}</Text></Row></Row></Row>
        <GroupedColumnChart labels={vm.trend.labels} primaryValues={vm.trend.current} secondaryValues={vm.trend.previous} primaryLabel={vm.comparison.currentLabel} secondaryLabel={vm.comparison.previousLabel} primaryColor={TOKENS.color.brand.primary} secondaryColor={TOKENS.color.content.subtle} frame={chartFrame} height={260} ariaLabel="Comparativo mensal das vendas" />
      </Stack>
    </Surface>
    <section className="sales-analysis-grid"><PlanComparison vm={vm} /><SellerRanking vm={vm} /></section>
    <RecentSales vm={vm} />
    <Text size="xs" tone="subtle" style={{ textAlign: "right" }}>Atualizado em {vm.updatedAt}</Text>
  </Stack></main>;
}

export function SalesPage({ snapshot, periodSelector }: { snapshot?: SalesSnapshot; periodSelector?: ReactNode }) {
  const { viewModel, isLoading } = useSalesController(snapshot);
  if (isLoading || !viewModel) return <LoadingScreen visible onExitComplete={() => undefined} label="Carregando análise de vendas" />;
  return <SalesContent vm={viewModel} periodSelector={periodSelector} />;
}
