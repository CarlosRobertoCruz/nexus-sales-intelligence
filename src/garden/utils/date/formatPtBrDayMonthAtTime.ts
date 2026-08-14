import { formatPtBrHourMinute } from "@/garden/utils/date/formatPtBrHourMinute";

/** Ex.: `21/07 às 13:27` — dia/mês + hora, sem hardcode. */
export function formatPtBrDayMonthAtTime(from: string | number | Date): string {
  const date = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(date.getTime())) return "—";
  const dayMonth = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const time = formatPtBrHourMinute(date);
  return `${dayMonth} às ${time}`;
}
