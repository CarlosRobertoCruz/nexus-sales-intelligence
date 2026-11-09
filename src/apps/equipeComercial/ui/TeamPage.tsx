import type { ReactNode } from "react";
import { MultiDonutChart } from "@/garden/charts";
import type { SellerId } from "@/core/types/commercialDashboard";
import { Badge, KpiCard, Row, Stack, Surface, Text } from "@/garden/foundations";
import { CheckCheckIcon, SalesChartIcon, SparklesIcon, UsersIcon } from "@/garden/foundations/assets/icons/icons";
import { TOKENS } from "@/garden/tokens";
import { TEAM_COPY } from "../copy/teamCopy";
import { useTeamController } from "../controller/useTeamController";
import type { TeamSnapshot } from "../types/team";

const memberColors: Record<SellerId, string> = { beatriz: "#ac91ff", karini: "#32c4ef", giovanna: "#f472b6", sara: "#ffb429", luana: "#2bd9ae", unknown: "#a69bc7" };

function Trend({ value }: { value: string }) {
  const favorable = value.startsWith("+");
  return <Text size="xs" weight={700} tone={null} style={{ color: favorable ? TOKENS.color.feedback.success : TOKENS.color.feedback.warning }}>{value}</Text>;
}

export function TeamPage({ snapshot, periodSelector }: { snapshot?: TeamSnapshot; periodSelector?: ReactNode }) {
  const { viewModel: vm } = useTeamController(snapshot);

  return (
    <main className="app-main">
      <Stack gap={TOKENS.spacing[24]}>
        <header className="page-header">
          <Stack gap={TOKENS.spacing[8]}>
            <Text size="xs" weight={800} tone="brand" style={{ textTransform: "uppercase", letterSpacing: TOKENS.typography.letterSpacing.eyebrow }}>{TEAM_COPY.eyebrow}</Text>
            <Text size="title-lg" weight={800} block>{TEAM_COPY.title}</Text>
            <Text size="md" tone="secondary" block>{TEAM_COPY.description}</Text>
          </Stack>
          <Row align="center" gap={TOKENS.spacing[10]} style={{ flexWrap: "wrap" }}><Badge variant="info">{vm.sourceLabel}</Badge>{periodSelector}</Row>
        </header>

        <section className="kpi-grid" aria-label="Indicadores da equipe comercial">
          <KpiCard label="Produção total" value={vm.summary.production} subLabel="vendas + renovações" icon={<SparklesIcon />} iconColor={TOKENS.color.chart.seriesPrimary} iconBg={TOKENS.color.brand.soft} />
          <KpiCard label="Vendas" value={vm.summary.sales} subLabel="realizadas no período" icon={<SalesChartIcon />} iconColor={TOKENS.color.feedback.info} iconBg={TOKENS.color.feedback.infoSoft} />
          <KpiCard label="Renovações" value={vm.summary.renewals} subLabel="concluídas e pendentes" icon={<CheckCheckIcon />} iconColor={TOKENS.color.feedback.success} iconBg={TOKENS.color.feedback.successSoft} />
          <KpiCard label="Equipe ativa" value={vm.summary.activeMembers} subLabel={`média de ${vm.summary.average} por consultora`} icon={<UsersIcon />} iconColor={TOKENS.color.feedback.warning} iconBg={TOKENS.color.feedback.warningSoft} />
        </section>

        <section className="team-insight-grid">
          <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
            <Stack gap={TOKENS.spacing[20]}>
              <Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{TEAM_COPY.performanceTitle}</Text><Text size="sm" tone="muted">{TEAM_COPY.performanceDescription}</Text></Stack>
              <Stack gap={TOKENS.spacing[14]}>
                {vm.members.map((member) => (
                  <div className="team-performance-row" key={member.id}>
                    <Row align="center" gap={TOKENS.spacing[12]}>
                      <span className="team-avatar"><Text size="sm" weight={800} tone="brand">{member.name.slice(0, 1)}</Text></span>
                      <Stack gap={TOKENS.spacing[2]} style={{ minWidth: 0 }}><Text size="sm" weight={800}>{member.position}. {member.name}</Text><Text size="xs" tone="muted">{member.sales} vendas · {member.renewals} renovações</Text></Stack>
                    </Row>
                    <Stack gap={TOKENS.spacing[8]}>
                      <Row align="center" justify="space-between"><Text size="xs" tone="muted">{member.share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da equipe</Text><Row align="center" gap={TOKENS.spacing[8]}><Text size="sm" weight={800}>{member.production}</Text><Trend value={member.growth} /></Row></Row>
                      <div className="team-production-track"><div style={{ width: `${(member.production / vm.maxProduction) * 100}%`, background: memberColors[member.id] }} /></div>
                    </Stack>
                  </div>
                ))}
              </Stack>
            </Stack>
          </Surface>

          <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
            <Stack gap={TOKENS.spacing[20]}>
              <Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{TEAM_COPY.concentrationTitle}</Text><Text size="sm" tone="muted">{TEAM_COPY.concentrationDescription}</Text></Stack>
              <Row align="center" justify="center" gap={TOKENS.spacing[24]} style={{ flexWrap: "wrap", paddingBlock: TOKENS.spacing[12] }}>
                <MultiDonutChart size={190} strokeWidth={10} trackColor={TOKENS.color.stroke.subtle}
                  segments={vm.members.map(member => ({ percentage: member.share, color: memberColors[member.id] }))}
                  tooltip={{ heading: "Concentração da produção", valueLabels: vm.members.map(member => member.name), counts: vm.members.map(member => member.production) }}>
                  <Stack align="center" gap={TOKENS.spacing[4]}><Text size="value" weight={800} tone={null} style={{ color: memberColors[vm.members[0]?.id ?? "unknown"] }}>{vm.summary.leaderShare.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</Text><Text size="xs" tone="muted">{vm.summary.leaderProduction ? vm.summary.leaderName : "Sem produção"}</Text></Stack>
                </MultiDonutChart>
                <Stack gap={TOKENS.spacing[8]} style={{ maxWidth: TOKENS.size[200] }}><Text size="xs" weight={700} tone="brand">LIDERANÇA NO PERÍODO</Text><Text size="lg" weight={800}>{vm.summary.leaderName}</Text><Text size="sm" tone="muted">{vm.summary.leaderProduction} movimentações comerciais no período selecionado.</Text></Stack>
              </Row>
              <div aria-label="Participação por colaboradora" style={{ display: "grid", gap: 14 }}>
                {vm.members.map(member => <Row key={member.id} align="center" gap={TOKENS.spacing[10]}>
                  <span className="reason-dot" style={{ background: memberColors[member.id] }} />
                  <Text size="sm" style={{ flex: 1 }}>{member.name}</Text>
                  <Text size="sm" weight={800} tone={null} style={{ color: memberColors[member.id] }}>{member.share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</Text>
                  <Text size="xs" tone="muted">{member.production}</Text>
                </Row>)}
              </div>
            </Stack>
          </Surface>
        </section>

        <Surface tone="subtle" padding={TOKENS.spacing[24]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
          <Stack gap={TOKENS.spacing[20]}>
            <Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>{TEAM_COPY.tableTitle}</Text><Text size="sm" tone="muted">{TEAM_COPY.tableDescription}</Text></Stack>
            <div className="team-table" role="table" aria-label="Desempenho detalhado da equipe comercial">
              <div className="team-table-head" role="row"><Text size="xs" weight={700} tone="muted">CONSULTORA</Text><Text size="xs" weight={700} tone="muted">VENDAS</Text><Text size="xs" weight={700} tone="muted">RENOVAÇÕES</Text><Text size="xs" weight={700} tone="muted">TOTAL</Text><Text size="xs" weight={700} tone="muted">PARTICIPAÇÃO</Text><Text size="xs" weight={700} tone="muted">EVOLUÇÃO</Text></div>
              {vm.members.map((member) => <div className="team-table-row" role="row" key={member.id}><Text size="sm" weight={800}>{member.name}</Text><Text size="sm">{member.sales}</Text><Text size="sm">{member.renewals}</Text><Text size="sm" weight={800}>{member.production}</Text><Text size="sm" tone="secondary">{member.share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</Text><Trend value={member.growth} /></div>)}
            </div>
          </Stack>
        </Surface>

        <Text size="xs" tone="subtle" style={{ textAlign: "right" }}>Atualizado em {vm.updatedAt}</Text>
      </Stack>
    </main>
  );
}
