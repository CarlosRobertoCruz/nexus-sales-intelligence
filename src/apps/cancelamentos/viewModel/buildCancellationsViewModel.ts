// Transforma dados e regras em indicadores e séries prontos para a UI.
import { formatPtBrInteger } from "@/garden/utils/number/formatPtBrInteger";
import { calculateCancellationGrowth, calculateCancellationShare, sumAvoidableCancellations, sumCancellations } from "../domain/cancellationMetrics";
import type { CancellationsSnapshot } from "../types/cancellations";

function formatGrowth(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function buildCancellationsViewModel(snapshot: CancellationsSnapshot) {
  const total = sumCancellations(snapshot.reasons);
  const previous = snapshot.monthly.at(-1)?.previousYear ?? 0;
  const avoidable = sumAvoidableCancellations(snapshot.reasons);
  const mainReason = [...snapshot.reasons].sort((a, b) => b.count - a.count)[0];
  const mostAffectedLocation = [...snapshot.locations].sort((a, b) => b.current - a.current)[0];

  return {
    sourceLabel: snapshot.sourceLabel,
    comparison: { currentLabel: snapshot.currentPeriodLabel, previousLabel: snapshot.previousPeriodLabel },
    referenceMonth: snapshot.referenceMonth,
    updatedAt: snapshot.updatedAt,
    summary: {
      total: formatPtBrInteger(total),
      growth: formatGrowth(calculateCancellationGrowth(total, previous)),
      avoided: formatPtBrInteger(previous - total),
      mainReason: mainReason.label,
      mainReasonShare: `${calculateCancellationShare(mainReason.count, total).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% do total`,
      avoidable: formatPtBrInteger(avoidable),
      avoidableShare: `${calculateCancellationShare(avoidable, total).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do total`,
      location: mostAffectedLocation.location,
      locationCount: `${mostAffectedLocation.current} cancelamentos`,
    },
    trend: {
      labels: snapshot.monthly.map((item) => item.month),
      current: snapshot.monthly.map((item) => item.currentYear),
      previous: snapshot.monthly.map((item) => item.previousYear),
    },
    reasons: snapshot.reasons.map((reason) => ({ ...reason, share: calculateCancellationShare(reason.count, total) })),
    locations: snapshot.locations.map((location) => ({ ...location, growth: formatGrowth(calculateCancellationGrowth(location.current, location.previous)) })),
    recentCancellations: snapshot.recentCancellations,
  } as const;
}

export type CancellationsViewModel = ReturnType<typeof buildCancellationsViewModel>;
