// garden/utils — normaliza taxas em Mbps para a maior unidade legível (Mbps ou Gbps).
// Retorna valor numérico + unidade; para formatar como string use formatLinkRateValue.
// NÃO classifica qualidade de sinal — isso é domínio de metricas.

/** Unidade de taxa de link normalizada (Mbps inteiro / Gbps com 1 casa). */
export type LinkRateUnit = "Mbps" | "Gbps";

/** Par de taxas TX+RX na mesma unidade normalizada. */
export interface NormalizedLinkRate {
  tx: number;
  rx: number;
  unit: LinkRateUnit;
}

/** Taxa única normalizada. */
export interface NormalizedRate {
  value: number;
  unit: LinkRateUnit;
}

/**
 * Normaliza um par TX/RX (em Mbps) para a mesma unidade.
 * Ambos >= 1000 → Gbps com 1 casa decimal; senão Mbps inteiro.
 */
export function normalizeLinkRate(txMbps: number, rxMbps: number): NormalizedLinkRate {
  if (txMbps >= 1000 && rxMbps >= 1000) {
    return {
      tx: Math.round((txMbps / 1000) * 10) / 10,
      rx: Math.round((rxMbps / 1000) * 10) / 10,
      unit: "Gbps",
    };
  }
  return {
    tx: Math.round(txMbps),
    rx: Math.round(rxMbps),
    unit: "Mbps",
  };
}

/** Normaliza uma única taxa em Mbps. >= 1000 → Gbps com 1 casa decimal; senão Mbps inteiro. */
export function normalizeRate(mbps: number): NormalizedRate {
  if (mbps >= 1000) {
    return { value: Math.round((mbps / 1000) * 10) / 10, unit: "Gbps" };
  }
  return { value: Math.round(mbps), unit: "Mbps" };
}
