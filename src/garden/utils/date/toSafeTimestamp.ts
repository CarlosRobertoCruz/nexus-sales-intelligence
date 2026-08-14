/** Camada core/utils/date — coercao de qualquer valor para timestamp em ms (fallback 0); util para ordenacao tolerante. */
import { toTimestamp } from "./toTimestamp";

export function toSafeTimestamp(value: unknown): number {
  return toTimestamp(value) ?? 0;
}