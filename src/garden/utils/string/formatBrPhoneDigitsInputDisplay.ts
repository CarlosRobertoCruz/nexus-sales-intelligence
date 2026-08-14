/**
 * Máscara de telefone BR (celular/fixo) para exibição enquanto o utilizador digita (máx. 11 dígitos).
 */
export function formatBrPhoneDigitsInputDisplay(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
