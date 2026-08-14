// garden/utils — formata valores de taxa de link já normalizados para exibição (Mbps / Gbps).
// Para normalizar o valor bruto antes de formatar, use normalizeLinkRate ou normalizeRate.
import type { LinkRateUnit } from "./normalizeLinkRate";

export type { LinkRateUnit };

/**
 * Formata valor de taxa já normalizado pra exibição.
 * Gbps → 1 casa decimal; Mbps → inteiro como string.
 */
export function formatLinkRateValue(value: number, unit: LinkRateUnit): string {
  return unit === "Gbps" ? value.toFixed(1) : String(value);
}
