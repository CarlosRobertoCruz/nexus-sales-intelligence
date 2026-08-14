import type { RenewalsSnapshot } from "../types/renewals";

export function getEmptyRenewalsSnapshot(): RenewalsSnapshot {
  return {
    sourceLabel: "Aguardando importação",
    currentPeriodLabel: "Período atual",
    previousPeriodLabel: "Sem período anterior",
    referenceMonth: "Nenhum período",
    updatedAt: "aguardando planilhas",
    monthly: [{ month: "—", currentYear: 0, previousYear: 0 }],
    benefits: [
      { id: "bonus-speed", label: "Bônus de velocidade", count: 0 },
      { id: "none", label: "Sem benefício adicional", count: 0 },
      { id: "double-speed", label: "Dobro de velocidade", count: 0 },
      { id: "upgrade", label: "Upgrade no plano", count: 0 },
      { id: "discount", label: "Desconto", count: 0 },
      { id: "downgrade", label: "Downgrade no plano", count: 0 },
    ],
    plans: [{ label: "Sem dados", count: 0 }],
    recentRenewals: [],
  };
}
