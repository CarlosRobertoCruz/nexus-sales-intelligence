import type { CancellationsSnapshot } from "../types/cancellations";

export function getEmptyCancellationsSnapshot(): CancellationsSnapshot {
  return {
    sourceLabel: "Aguardando importação",
    currentPeriodLabel: "Período atual",
    previousPeriodLabel: "Sem período anterior",
    referenceMonth: "Nenhum período",
    updatedAt: "aguardando planilhas",
    monthly: [{ month: "—", currentYear: 0, previousYear: 0 }],
    reasons: [
      { id: "no-coverage", label: "Mudança para local sem cobertura", count: 0, avoidable: false },
      { id: "dissatisfaction", label: "Insatisfação com o serviço", count: 0, avoidable: true },
      { id: "existing-provider", label: "Outro provedor no endereço", count: 0, avoidable: true },
      { id: "financial", label: "Motivo financeiro", count: 0, avoidable: true },
      { id: "other", label: "Outros motivos", count: 0, avoidable: false },
    ],
    locations: [{ location: "Sem dados", current: 0, previous: 0 }],
    recentCancellations: [],
  };
}
