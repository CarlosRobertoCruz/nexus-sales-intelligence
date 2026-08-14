import { formatRelativeAgoPtBr } from "./formatRelativeAgoPtBr";

/**
 * Igual a `formatRelativeAgoPtBr`, com "há" minúsculo.
 * Use em meta/linha onde a frase não começa com o relativo (ex.: "Última coleta · há 2h").
 */
export function formatRelativeAgoLowerPtBr(fromMs: number, nowMs: number): string {
  return formatRelativeAgoPtBr(fromMs, nowMs).replace(/^Há /, "há ");
}
