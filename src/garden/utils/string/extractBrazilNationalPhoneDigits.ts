/**
 * Extrai até 11 dígitos nacionais (DDD + assinante) a partir de texto colado ou legado com +55.
 */
export function extractBrazilNationalPhoneDigits(stored: string): string {
  const d = stored.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) return d.slice(2, 13);
  if (d.length > 11 && d.startsWith("55")) return d.slice(2);
  return d.slice(0, 11);
}
