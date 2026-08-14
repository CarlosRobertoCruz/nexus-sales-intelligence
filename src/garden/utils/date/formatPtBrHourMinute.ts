/** Camada core/utils/date — rotulo de hora HH:MM em locale pt-BR; usado em headers de bolha e lista de conversas. */
export function formatPtBrHourMinute(from: number | Date): string {
  const date = typeof from === "number" ? new Date(from) : from;
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
