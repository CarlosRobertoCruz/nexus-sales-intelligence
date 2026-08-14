// Formata uma data como rótulo relativo a `today` em pt-BR: "hoje", "ontem" ou "dd/mm".
// NÃO usa Intl — formato operacional fixo para listas e KPIs de eventos.
// NÃO cobre datas futuras; NÃO formata hora (use formatPtBrHourMinute para isso).
export function formatRelativeDayPtBr(date: Date, today: Date): string {
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "hoje";

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, yesterday)) return "ontem";

  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}
