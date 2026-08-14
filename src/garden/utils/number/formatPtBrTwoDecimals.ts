/** Formata número com 2 casas decimais no locale pt-BR (ex.: `-22,75`). */
export function formatPtBrTwoDecimals(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
