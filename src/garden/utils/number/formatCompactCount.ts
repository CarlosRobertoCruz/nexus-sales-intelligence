// garden/utils — utilitário puro de formatação de contadores inteiros grandes.
/** Compacta inteiros grandes pra exibição (ex.: 1200 → `1.2k`, 2e6 → `2M`). */
export function formatCompactCount(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}
