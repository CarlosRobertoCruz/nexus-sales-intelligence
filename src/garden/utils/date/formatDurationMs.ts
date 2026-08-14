// Formata uma duração em milissegundos para o padrão "Xm Ys" (ex.: "02m 35s").
// NÃO usa Intl — formato operacional fixo para exibição de duração de comando.
// NÃO formata horas; para durações longas use formatDurationFromMinutes.
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.round(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}
