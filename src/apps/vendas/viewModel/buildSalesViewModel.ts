// Prepara séries, indicadores e textos para consumo direto da UI.
import { formatPtBrInteger } from "@/garden/utils/number/formatPtBrInteger";
import { calculateSalesGrowth, calculateSalesShare, sumSales } from "../domain/salesMetrics";
import type { SalesSnapshot } from "../types/sales";

function formatGrowth(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function buildSalesViewModel(snapshot: SalesSnapshot) {
  const currentTotal = sumSales(snapshot.plans);
  const previousTotal = snapshot.plans.reduce((total, plan) => total + plan.previous, 0);
  const leader = [...snapshot.sellers].sort((a, b) => b.current - a.current)[0];
  const topPlan = [...snapshot.plans].sort((a, b) => b.current - a.current)[0];

  return {
    sourceLabel: snapshot.sourceLabel,
    comparison: { currentLabel: snapshot.currentPeriodLabel, previousLabel: snapshot.previousPeriodLabel },
    referenceMonth: snapshot.referenceMonth,
    updatedAt: snapshot.updatedAt,
    summary: {
      total: formatPtBrInteger(currentTotal),
      growth: formatGrowth(calculateSalesGrowth(currentTotal, previousTotal)),
      leader: leader.name,
      leaderSales: `${leader.current} vendas`,
      topPlan: topPlan.label,
      topPlanShare: `${calculateSalesShare(topPlan.current, currentTotal).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% do total`,
      averagePerSeller: (currentTotal / snapshot.sellers.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
    },
    trend: {
      labels: snapshot.monthly.map((item) => item.month),
      current: snapshot.monthly.map((item) => item.currentYear),
      previous: snapshot.monthly.map((item) => item.previousYear),
    },
    plans: snapshot.plans.map((plan) => ({
      ...plan,
      max: Math.max(plan.current, plan.previous),
      growth: formatGrowth(calculateSalesGrowth(plan.current, plan.previous)),
    })),
    sellers: [...snapshot.sellers]
      .sort((a, b) => b.current - a.current)
      .map((seller, index) => ({ ...seller, position: index + 1, growth: formatGrowth(calculateSalesGrowth(seller.current, seller.previous)) })),
    recentSales: snapshot.recentSales,
  } as const;
}

export type SalesViewModel = ReturnType<typeof buildSalesViewModel>;
