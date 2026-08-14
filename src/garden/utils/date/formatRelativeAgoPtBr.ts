/** Duração relativa pt-BR — ex.: `Há 2h 15m`, `Há 3 dias`. Sem hardcode de datas. */
export function formatRelativeAgoPtBr(fromMs: number, nowMs: number): string {
  const deltaMs = Math.max(0, nowMs - fromMs);
  const totalMinutes = Math.floor(deltaMs / 60_000);

  if (totalMinutes < 1) return "Há poucos minutos";
  if (totalMinutes < 60) return `Há ${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) {
    return minutes > 0 ? `Há ${hours}h ${minutes}m` : `Há ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? "Há 1 dia" : `Há ${days} dias`;
}
