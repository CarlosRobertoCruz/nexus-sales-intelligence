// Converte o snapshot em indicadores, séries e rótulos prontos para apresentação.
import { formatPtBrInteger } from "@/garden/utils/number/formatPtBrInteger";
import { calculateRenewalGrowth, calculateRenewalShare, sumRenewals } from "../domain/renewalMetrics";
import type { RenewalsSnapshot } from "../types/renewals";

function formatGrowth(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function buildRenewalsViewModel(snapshot: RenewalsSnapshot) {
  const total = sumRenewals(snapshot.benefits);
  const previous = snapshot.monthly.at(-1)?.previousYear ?? 0;
  const mainBenefit = [...snapshot.benefits].sort((a, b) => b.count - a.count)[0];
  const withoutBenefit = snapshot.benefits.find((benefit) => benefit.id === "none")?.count ?? 0;
  const topPlan = [...snapshot.plans].sort((a, b) => b.count - a.count)[0];

  return {
    sourceLabel: snapshot.sourceLabel,
    comparison: { currentLabel: snapshot.currentPeriodLabel, previousLabel: snapshot.previousPeriodLabel },
    referenceMonth: snapshot.referenceMonth,
    updatedAt: snapshot.updatedAt,
    summary: {
      total: formatPtBrInteger(total),
      growth: formatGrowth(calculateRenewalGrowth(total, previous)),
      mainBenefit: mainBenefit.label,
      mainBenefitShare: `${calculateRenewalShare(mainBenefit.count, total).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% do total`,
      withoutBenefit: formatPtBrInteger(withoutBenefit),
      withoutBenefitShare: `${calculateRenewalShare(withoutBenefit, total).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do total`,
      topPlan: topPlan.label,
      topPlanShare: `${calculateRenewalShare(topPlan.count, total).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% do total`,
    },
    trend: {
      labels: snapshot.monthly.map((item) => item.month),
      current: snapshot.monthly.map((item) => item.currentYear),
      previous: snapshot.monthly.map((item) => item.previousYear),
    },
    benefits: snapshot.benefits.map((benefit) => ({
      ...benefit,
      share: calculateRenewalShare(benefit.count, total),
    })),
    plans: snapshot.plans.map((plan) => ({
      ...plan,
      share: calculateRenewalShare(plan.count, total),
    })),
    recentRenewals: snapshot.recentRenewals,
  } as const;
}

export type RenewalsViewModel = ReturnType<typeof buildRenewalsViewModel>;
