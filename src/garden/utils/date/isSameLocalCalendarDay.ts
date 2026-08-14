/** Camada core/utils/date — compara dois timestamps quanto ao dia civil local; isola Date do dominio de negocio. */
export function isSameLocalCalendarDay(
  timestampA: number,
  timestampB: number
): boolean {
  const a = new Date(timestampA);
  const b = new Date(timestampB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
