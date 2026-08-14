import { formatPtBrDateOnly } from "@/garden/utils/date/formatPtBrDateOnly";

export function formatPtBrDateTime(from: string | number | Date): string {
  const date = from instanceof Date ? from : new Date(from as string | number);
  if (Number.isNaN(date.getTime())) return "-";
  const dateStr = formatPtBrDateOnly(date);
  const timeStr = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${dateStr} ${timeStr}`;
}
