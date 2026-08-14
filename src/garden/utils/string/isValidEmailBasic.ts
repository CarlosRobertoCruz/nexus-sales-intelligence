/** Padrão simples local@dominio.tld — não valida RFC completo. */
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailBasic(email: string): boolean {
  return SIMPLE_EMAIL_RE.test(email.trim());
}
