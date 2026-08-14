/** Extrai o primeiro inteiro (incluindo negativo) de uma string — ex.: `"6 (auto)"` → `6`. */
export function parseLeadingNumber(text: string): number | null {
  const match = text.match(/-?\d+/);
  return match ? parseInt(match[0], 10) : null;
}
