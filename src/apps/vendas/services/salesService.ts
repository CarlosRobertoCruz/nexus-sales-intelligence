import type { SalesSnapshot } from "../types/sales";
import { COMMERCIAL_SELLERS } from "../../../core/config/commercialSellers";
import { COMMERCIAL_PLANS } from "../../../core/config/commercialPlans";

export function getEmptySalesSnapshot(): SalesSnapshot {
  return {
    sourceLabel: "Aguardando importação",
    currentPeriodLabel: "Período atual",
    previousPeriodLabel: "Sem período anterior",
    referenceMonth: "Nenhum período",
    updatedAt: "aguardando planilhas",
    monthly: [{ month: "—", currentYear: 0, previousYear: 0 }],
    plans: COMMERCIAL_PLANS.map(({ label }) => ({ label, current: 0, previous: 0 })),
    sellers: COMMERCIAL_SELLERS.map(({ id, name }) => ({ id, name, current: 0, previous: 0 })),
    recentSales: [],
  };
}
