/**
 * Valor típico de `catch` — extrai `message` quando for `Error`; caso contrário devolve `fallback`.
 */
export function messageFromUnknownError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
