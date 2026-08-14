// Regras puras para interpretar volume, variação e concentração das renovações.
export function calculateRenewalGrowth(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function calculateRenewalShare(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}

export function sumRenewals(values: ReadonlyArray<{ count: number }>): number {
  return values.reduce((total, item) => total + item.count, 0);
}
