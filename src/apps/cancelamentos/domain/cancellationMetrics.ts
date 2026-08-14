// Regras puras para interpretar redução, participação e evitabilidade.
import type { CancellationReason } from "../types/cancellations";

export function calculateCancellationGrowth(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function calculateCancellationShare(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}

export function sumCancellations(reasons: ReadonlyArray<CancellationReason>): number {
  return reasons.reduce((total, reason) => total + reason.count, 0);
}

export function sumAvoidableCancellations(reasons: ReadonlyArray<CancellationReason>): number {
  return reasons.filter((reason) => reason.avoidable).reduce((total, reason) => total + reason.count, 0);
}
