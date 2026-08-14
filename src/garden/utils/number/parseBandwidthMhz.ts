/**
 * Extrai a maior largura em MHz de strings como `"20/40 MHz"` → `40`.
 * Sem match → fallback `20`.
 */
export function parseBandwidthMhz(text: string): number {
  const matches = [...text.matchAll(/(\d+)\s*MHz/gi)].map((m) => parseInt(m[1], 10));
  return matches.length > 0 ? Math.max(...matches) : 20;
}
