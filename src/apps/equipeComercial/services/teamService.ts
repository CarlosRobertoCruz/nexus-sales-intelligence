import type { TeamSnapshot } from "../types/team";
import { COMMERCIAL_SELLERS } from "../../../core/config/commercialSellers";

export function getEmptyTeamSnapshot(): TeamSnapshot {
  return {
    sourceLabel: "Aguardando importação",
    currentPeriodLabel: "Período atual",
    previousPeriodLabel: "Sem período anterior",
    referenceMonth: "Nenhum período",
    updatedAt: "aguardando planilhas",
    members: COMMERCIAL_SELLERS.map(({ id, name }) => ({ id, name, sales: 0, previousSales: 0, renewals: 0, previousRenewals: 0 })),
  };
}
