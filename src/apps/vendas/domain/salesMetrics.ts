// Regras puras usadas para interpretar o desempenho de vendas.
export function calculateSalesGrowth(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function calculateSalesShare(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}

export function sumSales(values: ReadonlyArray<{ current: number }>): number {
  return values.reduce((total, item) => total + item.current, 0);
}
