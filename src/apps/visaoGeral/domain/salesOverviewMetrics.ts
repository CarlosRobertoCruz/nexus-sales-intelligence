// Regras puras de cálculo; não conhece React, visual ou fonte externa.
import type { SalesOverviewSnapshot } from "../types/salesOverview";

export function sumCurrentSales(snapshot: SalesOverviewSnapshot): number {
  return snapshot.sales.reduce((total, plan) => total + plan.current, 0);
}

export function sumPreviousSales(snapshot: SalesOverviewSnapshot): number {
  return snapshot.sales.reduce((total, plan) => total + plan.previous, 0);
}

export function calculateGrowth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function calculateShare(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}
