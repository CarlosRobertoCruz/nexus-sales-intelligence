// garden/utils — formata inteiro com separador de milhar pt-BR (ex.: 1234 → "1.234").
/** Formata inteiro sem casas decimais no locale pt-BR. */
export function formatPtBrInteger(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
