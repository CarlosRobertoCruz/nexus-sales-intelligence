/**
 * Escala de eixo Y para gráficos leves (sem d3) — reutilizável em qualquer tela.
 */

/** Teto "bonito" acima de `value` (1 / 2 / 5 * 10^n). */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const f = value / base;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * base;
}

/** Máximo do gráfico a partir de pontos, com pequena folga. */
export function maxYFromSeries(lists: number[][], minCeiling = 1): number {
  const flat = lists.flat();
  const raw = flat.length ? Math.max(...flat) : 0;
  if (raw <= 0) {
    return minCeiling;
  }
  return niceCeil(raw * 1.02);
}

/** Ticks de 0 a maxY com passo aproximadamente uniforme. */
export function linearYTicks(maxY: number, tickCount: number): number[] {
  const n = Math.max(2, tickCount);
  if (maxY <= 0) {
    return Array.from({ length: n }, () => 0);
  }
  return Array.from({ length: n }, (_, i) => Math.round((i / (n - 1)) * maxY));
}

/** Índices dos pontos a exibir no eixo X (distribuição uniforme até `maxLabels`). */
export function xLabelIndexSet(n: number, maxLabels: number): Set<number> {
  if (n <= 0) return new Set();
  if (n === 1) return new Set([0]);
  const cap = Math.max(2, Math.min(maxLabels, n));
  const s = new Set<number>();
  for (let k = 0; k < cap; k++) {
    s.add(Math.round((k * (n - 1)) / (cap - 1)));
  }
  return s;
}

/** Índice do maior valor (primeiro, se empate). */
export function argMax(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0);
}
