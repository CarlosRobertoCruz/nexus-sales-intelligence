// Traduz métricas do domínio para valores, rótulos e séries prontos para a UI.
import { formatPtBrInteger } from "@/garden/utils/number/formatPtBrInteger";
import { calculateGrowth, calculateShare, sumCurrentSales, sumPreviousSales } from "../domain/salesOverviewMetrics";
import { SALES_PLAN_LABELS } from "../copy/salesOverviewCopy";
import type { SalesOverviewSnapshot } from "../types/salesOverview";

function formatGrowth(value: number | null): string {
  if (value === null) return "novo no período";
  const signal = value > 0 ? "+" : "";
  return `${signal}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function buildSalesOverviewViewModel(snapshot: SalesOverviewSnapshot) {
  const totalSales = sumCurrentSales(snapshot);
  const previousSales = sumPreviousSales(snapshot);
  const leadingPlan = [...snapshot.sales].sort((a, b) => b.current - a.current)[0];
  const salesGrowth = calculateGrowth(totalSales, previousSales);

  return {
    sourceLabel: snapshot.sourceLabel,
    referenceMonth: snapshot.referenceMonth,
    updatedAt: snapshot.updatedAt,
    summary: {
      sales: { value: formatPtBrInteger(totalSales), trend: formatGrowth(salesGrowth), direction: salesGrowth != null && salesGrowth >= 0 ? "up" : "down" },
      renewals: { value: formatPtBrInteger(snapshot.renewals.current), trend: formatGrowth(calculateGrowth(snapshot.renewals.current, snapshot.renewals.previous)) },
      cancellations: { value: formatPtBrInteger(snapshot.cancellations.current), trend: formatGrowth(calculateGrowth(snapshot.cancellations.current, snapshot.cancellations.previous)) },
      reactivations: { value: formatPtBrInteger(snapshot.reactivations.current), trend: formatGrowth(calculateGrowth(snapshot.reactivations.current, snapshot.reactivations.previous)) },
    },
    plans: snapshot.sales.map((plan) => ({
      id: plan.id,
      label: SALES_PLAN_LABELS[plan.id].short,
      fullLabel: SALES_PLAN_LABELS[plan.id].full,
      current: plan.current,
      previous: plan.previous,
      growth: formatGrowth(calculateGrowth(plan.current, plan.previous)),
      share: calculateShare(plan.current, totalSales),
    })),
    leadingPlan: {
      label: SALES_PLAN_LABELS[leadingPlan.id].full,
      percentage: calculateShare(leadingPlan.current, totalSales),
      value: leadingPlan.current,
    },
  } as const;
}

export type SalesOverviewViewModel = ReturnType<typeof buildSalesOverviewViewModel>;
