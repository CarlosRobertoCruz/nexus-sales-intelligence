export function formatPtBrDateOnly(from: string | number | Date): string {
  const date = from instanceof Date ? from : new Date(from as string | number);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
