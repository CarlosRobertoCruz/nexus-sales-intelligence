import type { SalesOverviewSnapshot } from "../types/salesOverview";

export function getEmptySalesOverview(): SalesOverviewSnapshot {
  return {
    sourceLabel: "Aguardando importação",
    referenceMonth: "Nenhum período",
    updatedAt: "aguardando planilhas",
    sales: ["combo-plus", "combo-total-plus", "combo-view", "combo-ultra", "power-plus", "ultra-power", "other"].map((id) => ({ id: id as SalesOverviewSnapshot["sales"][number]["id"], current: 0, previous: 0 })),
    renewals: { current: 0, previous: 0 },
    cancellations: { current: 0, previous: 0 },
    reactivations: { current: 0, previous: 0 },
  };
}
