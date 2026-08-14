export function formatDurationFromMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  if (safeMinutes === 0) return "0min";

  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours <= 0) return `${mins}min`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}
