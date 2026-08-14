import { formatPtBrInteger } from "@/garden/utils/number/formatPtBrInteger";
import { memberProduction, performanceGrowth, performanceShare, previousMemberProduction, totalTeamProduction } from "../domain/teamMetrics";
import type { TeamSnapshot } from "../types/team";

function formatGrowth(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function buildTeamViewModel(snapshot: TeamSnapshot) {
  const total = totalTeamProduction(snapshot.members);
  const totalSales = snapshot.members.reduce((sum, member) => sum + member.sales, 0);
  const totalRenewals = snapshot.members.reduce((sum, member) => sum + member.renewals, 0);
  const members = [...snapshot.members]
    .sort((a, b) => memberProduction(b) - memberProduction(a))
    .map((member, index) => {
      const production = memberProduction(member);
      const previousProduction = previousMemberProduction(member);
      return {
        ...member,
        position: index + 1,
        production,
        previousProduction,
        share: performanceShare(production, total),
        growth: formatGrowth(performanceGrowth(production, previousProduction)),
      };
    });
  const leader = members[0];

  return {
    sourceLabel: snapshot.sourceLabel,
    referenceMonth: snapshot.referenceMonth,
    updatedAt: snapshot.updatedAt,
    comparison: { currentLabel: snapshot.currentPeriodLabel, previousLabel: snapshot.previousPeriodLabel },
    summary: {
      production: formatPtBrInteger(total),
      sales: formatPtBrInteger(totalSales),
      renewals: formatPtBrInteger(totalRenewals),
      activeMembers: String(members.filter((member) => member.production > 0).length),
      leaderName: leader?.name ?? "Sem dados",
      leaderProduction: leader?.production ?? 0,
      leaderShare: leader?.share ?? 0,
      average: members.length ? (total / members.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0",
    },
    members,
    maxProduction: Math.max(1, ...members.map((member) => member.production)),
  } as const;
}

export type TeamViewModel = ReturnType<typeof buildTeamViewModel>;
