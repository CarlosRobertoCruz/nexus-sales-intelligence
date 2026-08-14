/** Camada core/utils/date — coercao estrita para timestamp em ms (number/Date/string ISO); retorna null em invalidos. */
export function toTimestamp(value: unknown): number | null {
  if (typeof value === "number") return value;

  if (value instanceof Date) return value.getTime();

  if (typeof value === "string") {
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? null : ts;
  }

  return null;
}