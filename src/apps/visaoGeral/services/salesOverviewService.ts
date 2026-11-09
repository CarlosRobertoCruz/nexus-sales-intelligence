import type { SalesOverviewSnapshot } from "../types/salesOverview";
import { COMMERCIAL_PLANS } from "../../../core/config/commercialPlans";

export function getEmptySalesOverview(): SalesOverviewSnapshot {
  return {
    sourceLabel: "Aguardando importação",
    referenceMonth: "Nenhum período",
    updatedAt: "aguardando planilhas",
    sales: COMMERCIAL_PLANS.map(({ id }) => ({ id, current: 0, previous: 0 })),
    renewals: { current: 0, previous: 0 },
    cancellations: { current: 0, previous: 0 },
    reactivations: { current: 0, previous: 0 },
  };
}
