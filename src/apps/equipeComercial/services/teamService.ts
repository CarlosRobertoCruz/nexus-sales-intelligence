import type { TeamSnapshot } from "../types/team";

export function getEmptyTeamSnapshot(): TeamSnapshot {
  return {
    sourceLabel: "Aguardando importação",
    currentPeriodLabel: "Período atual",
    previousPeriodLabel: "Sem período anterior",
    referenceMonth: "Nenhum período",
    updatedAt: "aguardando planilhas",
    members: [
      { id: "beatriz", name: "Beatriz", sales: 0, previousSales: 0, renewals: 0, previousRenewals: 0 },
      { id: "karini", name: "Karini", sales: 0, previousSales: 0, renewals: 0, previousRenewals: 0 },
      { id: "giovanna", name: "Giovanna", sales: 0, previousSales: 0, renewals: 0, previousRenewals: 0 },
      { id: "sara", name: "Sara", sales: 0, previousSales: 0, renewals: 0, previousRenewals: 0 },
    ],
  };
}
