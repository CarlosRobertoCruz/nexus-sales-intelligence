import type { SalesSnapshot } from "../types/sales";
import { COMMERCIAL_SELLERS } from "../../../core/config/commercialSellers";

export function getEmptySalesSnapshot(): SalesSnapshot {
  return {
    sourceLabel: "Aguardando importação",
    currentPeriodLabel: "Período atual",
    previousPeriodLabel: "Sem período anterior",
    referenceMonth: "Nenhum período",
    updatedAt: "aguardando planilhas",
    monthly: [{ month: "—", currentYear: 0, previousYear: 0 }],
    plans: ["600 Mega Combo Plus", "600 Mega Combo Total Plus", "600 Mega Combo View", "720 Mega Combo Ultra", "900 Mega Power Plus", "1 Giga Ultra Power", "Outros planos"].map((label) => ({ label, current: 0, previous: 0 })),
    sellers: COMMERCIAL_SELLERS.map(({ id, name }) => ({ id, name, current: 0, previous: 0 })),
    recentSales: [],
  };
}
